// StudioBook - weekly booking schedule backed by a shared Node.js API
(() => {
  const APP_KEYS = {
    USER_ID: "studiobook_user_id",
    USER_NAME: "studiobook_user_name",
    WEEK_START: "studiobook_week_start",
    THEME: "studiobook_theme"
  };

  const API_ROUTES = {
    STATE: "/state",
    REGISTER: "/register",
    BOOKINGS: "/bookings"
  };

  const DAY_START = 9 * 60;
  const DAY_END = 22 * 60;
  const STEP = 30;
  const DURATIONS = [30, 60, 90, 120, 180];
  const FALLBACK_ROOMS = ["кабинет большой", "песочница", "кабинет математики"];
  const WEEKDAY_NAMES_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const SYNC_INTERVAL_MS = 15000;

  const today = new Date();

  const state = {
    userId: "",
    userName: "",
    weekStart: formatDateForInput(getWeekStart(today)),
    theme: "dark",
    rooms: [...FALLBACK_ROOMS],
    users: [],
    bookings: [],
    sync: {
      loading: false,
      lastLoadedAt: null,
      online: false
    },
    modal: {
      date: formatDateForInput(today),
      room: FALLBACK_ROOMS[0],
      roomLocked: false
    }
  };

  let syncTimer = null;

  const headerUserName = document.getElementById("headerUserName");
  const weekRangeLabel = document.getElementById("weekRangeLabel");
  const prevWeekBtn = document.getElementById("prevWeekBtn");
  const nextWeekBtn = document.getElementById("nextWeekBtn");
  const currentWeekBtn = document.getElementById("currentWeekBtn");
  const weekDaysStrip = document.getElementById("weekDaysStrip");
  const weeklyGrid = document.getElementById("weeklyGrid");
  const myBookingsContainer = document.getElementById("myBookingsContainer");
  const myBookingsCount = document.getElementById("myBookingsCount");
  const openBookingFromHeaderBtn = document.getElementById("openBookingFromHeaderBtn");
  const toggleThemeBtn = document.getElementById("toggleThemeBtn");
  const syncStatus = document.getElementById("syncStatus");

  const bookingModal = document.getElementById("bookingModal");
  const closeBookingModalBtn = document.getElementById("closeBookingModalBtn");
  const bookingForm = document.getElementById("bookingForm");
  const modalDateText = document.getElementById("modalDateText");
  const modalRoomText = document.getElementById("modalRoomText");
  const lockedRoomBlock = document.getElementById("lockedRoomBlock");
  const roomSelectBlock = document.getElementById("roomSelectBlock");
  const roomSelect = document.getElementById("roomSelect");
  const startTimeSelect = document.getElementById("startTimeSelect");
  const durationSelect = document.getElementById("durationSelect");
  const endTimePreview = document.getElementById("endTimePreview");
  const bookingError = document.getElementById("bookingError");

  const userModal = document.getElementById("userModal");
  const userForm = document.getElementById("userForm");
  const userNameInput = document.getElementById("userNameInput");
  const userFormError = document.getElementById("userFormError");
  const serverHelpText = document.getElementById("serverHelpText");
  const changeUserBtn = document.getElementById("changeUserBtn");
  const toastContainer = document.getElementById("toastContainer");

  init().catch((error) => {
    console.error(error);
    showToast("Не удалось загрузить данные с сервера", "error");
    updateSyncStatus();
  });

  async function init() {
    loadLocalState();
    fillModalFields();
    bindEvents();
    renderAll();
    await refreshRemoteState({ silent: true });
    startAutoSync();

    if (!state.userId || !state.userName) {
      openUserModal(true);
    }
  }

  function bindEvents() {
    prevWeekBtn.addEventListener("click", () => shiftWeek(-1));
    nextWeekBtn.addEventListener("click", () => shiftWeek(1));
    currentWeekBtn.addEventListener("click", goToCurrentWeek);
    toggleThemeBtn.addEventListener("click", toggleTheme);

    openBookingFromHeaderBtn.addEventListener("click", () => {
      openBookingModal({
        date: formatDateForInput(new Date()),
        room: state.rooms[0] || FALLBACK_ROOMS[0],
        lockRoom: false
      });
    });

    closeBookingModalBtn.addEventListener("click", closeBookingModal);
    bookingModal.addEventListener("click", (e) => {
      if (e.target === bookingModal) closeBookingModal();
    });

    [roomSelect, startTimeSelect, durationSelect].forEach((el) => {
      el.addEventListener("change", validateBookingForm);
    });

    bookingForm.addEventListener("submit", submitBookingForm);
    userForm.addEventListener("submit", submitUserForm);
    changeUserBtn.addEventListener("click", () => openUserModal(false));
    userModal.addEventListener("click", (e) => {
      if (e.target === userModal && state.userId) closeUserModal();
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        refreshRemoteState({ silent: true });
      }
    });

    document.addEventListener("click", (e) => {
      const openCellBookingBtn = e.target.closest("[data-action='open-booking']");
      if (openCellBookingBtn) {
        const room = openCellBookingBtn.getAttribute("data-room");
        const date = openCellBookingBtn.getAttribute("data-date");
        openBookingModal({ room, date, lockRoom: true });
        return;
      }

      const cancelBtn = e.target.closest("[data-action='cancel-booking']");
      if (cancelBtn) {
        const bookingId = cancelBtn.getAttribute("data-id");
        cancelBookingById(bookingId);
      }
    });
  }

  function startAutoSync() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(() => {
      refreshRemoteState({ silent: true });
    }, SYNC_INTERVAL_MS);
  }

  function loadLocalState() {
    const savedUserId = localStorage.getItem(APP_KEYS.USER_ID);
    const savedName = localStorage.getItem(APP_KEYS.USER_NAME);
    const savedWeekStart = localStorage.getItem(APP_KEYS.WEEK_START);
    const savedTheme = localStorage.getItem(APP_KEYS.THEME);

    state.userId = savedUserId ? savedUserId.trim() : "";
    state.userName = savedName ? savedName.trim() : "";

    if (savedWeekStart && /^\d{4}-\d{2}-\d{2}$/.test(savedWeekStart)) {
      state.weekStart = formatDateForInput(getWeekStart(parseDateFromInput(savedWeekStart)));
    }

    state.theme = savedTheme === "light" ? "light" : "dark";
    applyTheme(state.theme);
  }

  function saveLocalUser() {
    localStorage.setItem(APP_KEYS.USER_ID, state.userId);
    localStorage.setItem(APP_KEYS.USER_NAME, state.userName);
  }

  function clearLocalUser() {
    state.userId = "";
    state.userName = "";
    localStorage.removeItem(APP_KEYS.USER_ID);
    localStorage.removeItem(APP_KEYS.USER_NAME);
  }

  function saveWeekStart() {
    localStorage.setItem(APP_KEYS.WEEK_START, state.weekStart);
  }

  function saveTheme() {
    localStorage.setItem(APP_KEYS.THEME, state.theme);
  }

  async function refreshRemoteState({ silent = false } = {}) {
    if (state.sync.loading) return;

    state.sync.loading = true;
    updateSyncStatus();

    try {
      const payload = await apiRequest(API_ROUTES.STATE);
      state.rooms = Array.isArray(payload.rooms) && payload.rooms.length > 0 ? payload.rooms : [...FALLBACK_ROOMS];
      state.users = Array.isArray(payload.users) ? payload.users : [];
      state.bookings = Array.isArray(payload.bookings) ? payload.bookings : [];
      state.sync.online = true;
      state.sync.lastLoadedAt = new Date();

      if (state.userId) {
        const currentUser = state.users.find((user) => user.id === state.userId);
        if (!currentUser) {
          clearLocalUser();
          if (!silent) {
            showToast("Сеанс пользователя сброшен, зарегистрируйтесь заново", "error");
          }
          openUserModal(true);
        } else {
          state.userName = currentUser.name;
          saveLocalUser();
        }
      }

      fillModalFields();
      renderAll();
      validateBookingForm();
    } catch (error) {
      state.sync.online = false;
      if (!silent) {
        showToast(error.message || "Ошибка синхронизации с сервером", "error");
      }
    } finally {
      state.sync.loading = false;
      updateSyncStatus();
    }
  }

  function renderAll() {
    headerUserName.textContent = state.userName || "—";
    updateThemeButtonLabel();
    updateSyncStatus();
    renderWeekHeader();
    renderWeeklySchedule();
    renderMyBookings();
    updateCurrentWeekButtonState();
  }

  function updateSyncStatus() {
    if (!syncStatus) return;

    if (state.sync.loading) {
      syncStatus.textContent = "Сервер: синхронизация...";
      return;
    }

    if (!state.sync.online) {
      syncStatus.textContent = "Сервер: недоступен";
      return;
    }

    const timeLabel = state.sync.lastLoadedAt
      ? state.sync.lastLoadedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      : "только что";
    syncStatus.textContent = `Сервер: онлайн, обновлено ${timeLabel}`;
  }

  function getServerLaunchHint() {
    if (window.location.protocol === "file:") {
      return "Сайт открыт как файл. Откройте его через Vercel-домен или локальный сервер.";
    }

    if (!state.sync.online) {
      return "Серверная часть недоступна. Проверьте деплой Vercel и переменные окружения.";
    }

    return "Сервер подключён. После сохранения имени можно продолжать работу.";
  }

  function renderUserFormStatus(message = "") {
    if (userFormError) {
      userFormError.textContent = message;
    }

    if (serverHelpText) {
      serverHelpText.textContent = getServerLaunchHint();
    }
  }

  function applyTheme(theme) {
    document.body.classList.toggle("light-theme", theme === "light");
  }

  function updateThemeButtonLabel() {
    toggleThemeBtn.textContent = `Тема: ${state.theme === "light" ? "Светлая" : "Темная"}`;
  }

  function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme(state.theme);
    saveTheme();
    updateThemeButtonLabel();
  }

  function renderWeekHeader() {
    const weekDates = getWeekDates(state.weekStart);
    const startDate = parseDateFromInput(weekDates[0]);
    const endDate = parseDateFromInput(weekDates[6]);
    const todayStr = formatDateForInput(new Date());

    weekRangeLabel.textContent = `${formatDateLongShort(startDate)} — ${formatDateLongShort(endDate)}`;
    weekDaysStrip.innerHTML = "";

    weekDates.forEach((dateStr, index) => {
      const chip = document.createElement("div");
      chip.className = "day-chip";
      if (dateStr === todayStr) chip.classList.add("is-today");
      chip.textContent = `${WEEKDAY_NAMES_SHORT[index]} ${formatDateShort(dateStr)}`;
      weekDaysStrip.appendChild(chip);
    });
  }

  function renderWeeklySchedule() {
    const weekDates = getWeekDates(state.weekStart);
    const todayStr = formatDateForInput(new Date());
    weeklyGrid.innerHTML = "";

    const cornerCell = document.createElement("div");
    cornerCell.className = "corner-cell";
    cornerCell.textContent = "Кабинет / День";
    weeklyGrid.appendChild(cornerCell);

    weekDates.forEach((dateStr, index) => {
      const cell = document.createElement("div");
      cell.className = "weekday-cell";
      if (dateStr === todayStr) cell.classList.add("is-today");
      cell.innerHTML = `
        <div class="weekday-name">${WEEKDAY_NAMES_SHORT[index]}</div>
        <div class="weekday-date">${formatDateShort(dateStr)}</div>
      `;
      weeklyGrid.appendChild(cell);
    });

    state.rooms.forEach((room) => {
      const roomNameCell = document.createElement("div");
      roomNameCell.className = "room-name-cell";
      roomNameCell.textContent = room;
      weeklyGrid.appendChild(roomNameCell);

      weekDates.forEach((dateStr) => {
        const dayBookings = getBookingsForRoomAndDate(room, dateStr);
        const scheduleCell = document.createElement("div");
        scheduleCell.className = "schedule-cell";
        if (dayBookings.length > 0) scheduleCell.classList.add("has-bookings");

        if (dayBookings.length === 0) {
          scheduleCell.innerHTML = `
            <div class="free-label">Свободно</div>
            <button type="button" class="book-btn" data-action="open-booking" data-room="${room}" data-date="${dateStr}">
              Забронировать
            </button>
          `;
        } else {
          dayBookings.forEach((booking) => {
            const item = document.createElement("div");
            item.className = "booking-item";

            const cancelControl = booking.userId === state.userId
              ? `<button type="button" class="cancel-btn mt-1" data-action="cancel-booking" data-id="${booking.id}">Отменить</button>`
              : "";

            item.innerHTML = `
              <div class="booking-name">${booking.userName}</div>
              <div class="booking-time">${minutesToTime(booking.startMin)} – ${minutesToTime(booking.endMin)}</div>
              ${cancelControl}
            `;
            scheduleCell.appendChild(item);
          });

          const addBtn = document.createElement("button");
          addBtn.type = "button";
          addBtn.className = "book-btn";
          addBtn.textContent = "Забронировать";
          addBtn.setAttribute("data-action", "open-booking");
          addBtn.setAttribute("data-room", room);
          addBtn.setAttribute("data-date", dateStr);
          scheduleCell.appendChild(addBtn);
        }

        weeklyGrid.appendChild(scheduleCell);
      });
    });
  }

  function renderMyBookings() {
    const list = state.bookings
      .filter((booking) => booking.userId === state.userId)
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        return byDate !== 0 ? byDate : a.startMin - b.startMin;
      });

    myBookingsCount.textContent = String(list.length);
    myBookingsContainer.innerHTML = "";

    if (!state.userId || list.length === 0) {
      myBookingsContainer.innerHTML = `
        <div class="empty-state">
          ${state.userId ? "У вас пока нет бронирований." : "Сначала зарегистрируйтесь на сервере."}
        </div>
      `;
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "space-y-3";

    list.forEach((booking) => {
      const item = document.createElement("div");
      item.className = "my-booking-item";
      item.innerHTML = `
        <div class="min-w-0">
          <p class="truncate font-medium text-slate-100">${booking.room}</p>
          <p class="truncate text-sm text-slate-300">${formatDateLong(booking.date)}</p>
          <p class="text-sm text-studio-accent">${minutesToTime(booking.startMin)} – ${minutesToTime(booking.endMin)}</p>
        </div>
        <button type="button" class="cancel-btn" data-action="cancel-booking" data-id="${booking.id}">
          Отменить
        </button>
      `;
      wrap.appendChild(item);
    });

    myBookingsContainer.appendChild(wrap);
  }

  function fillModalFields() {
    const previousRoom = roomSelect.value || state.modal.room;
    const previousStartTime = startTimeSelect.value || String(DAY_START);
    const previousDuration = durationSelect.value || String(DURATIONS[0]);

    roomSelect.innerHTML = state.rooms.map((room) => `<option value="${room}">${room}</option>`).join("");

    const startOptions = buildStartTimes()
      .map((minutes) => `<option value="${minutes}">${minutesToTime(minutes)}</option>`)
      .join("");
    startTimeSelect.innerHTML = startOptions;

    durationSelect.innerHTML = DURATIONS
      .map((duration) => `<option value="${duration}">${durationLabel(duration)}</option>`)
      .join("");

    if (!state.rooms.includes(state.modal.room)) {
      state.modal.room = state.rooms[0] || FALLBACK_ROOMS[0];
    }

    roomSelect.value = state.rooms.includes(previousRoom) ? previousRoom : state.modal.room;
    startTimeSelect.value = buildStartTimes().includes(Number(previousStartTime))
      ? previousStartTime
      : String(DAY_START);
    durationSelect.value = DURATIONS.includes(Number(previousDuration))
      ? previousDuration
      : String(DURATIONS[0]);
  }

  function openBookingModal({ date, room, lockRoom }) {
    if (!state.userId) {
      openUserModal(true);
      return;
    }

    state.modal.date = date;
    state.modal.room = room;
    state.modal.roomLocked = Boolean(lockRoom);

    modalDateText.textContent = formatDateLong(state.modal.date);
    modalRoomText.textContent = state.modal.room;
    roomSelect.value = state.modal.room;

    roomSelectBlock.classList.toggle("hidden", state.modal.roomLocked);
    lockedRoomBlock.classList.toggle("hidden", !state.modal.roomLocked);

    bookingError.textContent = "";
    validateBookingForm();

    bookingModal.classList.remove("hidden");
    bookingModal.setAttribute("aria-hidden", "false");
  }

  function closeBookingModal() {
    bookingModal.classList.add("hidden");
    bookingModal.setAttribute("aria-hidden", "true");
  }

  function getModalRoom() {
    return state.modal.roomLocked ? state.modal.room : roomSelect.value;
  }

  function validateBookingForm() {
    const room = getModalRoom();
    const startMin = Number(startTimeSelect.value);
    const duration = Number(durationSelect.value);
    const endMin = startMin + duration;

    if (!Number.isFinite(startMin) || !Number.isFinite(duration)) {
      bookingError.textContent = "";
      endTimePreview.textContent = "—";
      return false;
    }

    endTimePreview.textContent = minutesToTime(endMin);

    if (endMin > DAY_END) {
      bookingError.textContent = "Слот выходит за границы дня (до 22:00)";
      return false;
    }

    const hasConflict = state.bookings.some((booking) =>
      booking.room === room &&
      booking.date === state.modal.date &&
      startMin < booking.endMin &&
      endMin > booking.startMin
    );

    if (hasConflict) {
      bookingError.textContent = "Время уже занято";
      return false;
    }

    bookingError.textContent = "";
    return true;
  }

  async function submitBookingForm(e) {
    e.preventDefault();

    if (!validateBookingForm()) {
      showToast("Невозможно сохранить бронь", "error");
      return;
    }

    try {
      await apiRequest(API_ROUTES.BOOKINGS, {
        method: "POST",
        body: JSON.stringify({
          userId: state.userId,
          room: getModalRoom(),
          date: state.modal.date,
          startMin: Number(startTimeSelect.value),
          duration: Number(durationSelect.value)
        })
      });

      await refreshRemoteState({ silent: true });
      closeBookingModal();
      showToast("Бронирование успешно создано", "success");
    } catch (error) {
      bookingError.textContent = error.message || "Не удалось создать бронь";
      showToast(bookingError.textContent, "error");
      await refreshRemoteState({ silent: true });
    }
  }

  async function cancelBookingById(bookingId) {
    if (!bookingId || !state.userId) return;

    try {
      await apiRequest(`${API_ROUTES.BOOKINGS}/${bookingId}`, {
        method: "DELETE",
        body: JSON.stringify({ userId: state.userId })
      });

      await refreshRemoteState({ silent: true });
      validateBookingForm();
      showToast("Бронирование отменено", "success");
    } catch (error) {
      showToast(error.message || "Не удалось отменить бронь", "error");
      await refreshRemoteState({ silent: true });
    }
  }

  function shiftWeek(delta) {
    const base = parseDateFromInput(state.weekStart);
    base.setDate(base.getDate() + delta * 7);
    state.weekStart = formatDateForInput(getWeekStart(base));
    saveWeekStart();
    renderAll();
  }

  function goToCurrentWeek() {
    state.weekStart = formatDateForInput(getWeekStart(new Date()));
    saveWeekStart();
    renderAll();
  }

  function updateCurrentWeekButtonState() {
    const currentWeek = formatDateForInput(getWeekStart(new Date()));
    currentWeekBtn.classList.toggle("is-active", state.weekStart === currentWeek);
  }

  function openUserModal(force) {
    userNameInput.value = state.userName;
    renderUserFormStatus();
    userModal.classList.remove("hidden");
    userModal.setAttribute("aria-hidden", "false");
    userModal.setAttribute("data-force", force ? "1" : "0");
    setTimeout(() => userNameInput.focus(), 0);
  }

  function closeUserModal() {
    userModal.classList.add("hidden");
    userModal.setAttribute("aria-hidden", "true");
    userModal.setAttribute("data-force", "0");
  }

  async function submitUserForm(e) {
    e.preventDefault();
    const newName = (userNameInput.value || "").trim();
    renderUserFormStatus();

    if (!newName) {
      const message = "Введите имя пользователя";
      renderUserFormStatus(message);
      showToast(message, "error");
      return;
    }

    try {
      const payload = await apiRequest(API_ROUTES.REGISTER, {
        method: "POST",
        body: JSON.stringify({ name: newName })
      });

      state.userId = payload.user.id;
      state.userName = payload.user.name;
      saveLocalUser();
      await refreshRemoteState({ silent: true });
      renderAll();
      closeUserModal();
      showToast(payload.created ? "Пользователь зарегистрирован" : "Вход выполнен", "success");
    } catch (error) {
      const message = error.message || "Не удалось сохранить пользователя";
      renderUserFormStatus(message);
      showToast(message, "error");
    }
  }

  function getBookingsForRoomAndDate(room, dateStr) {
    return state.bookings
      .filter((booking) => booking.room === room && booking.date === dateStr)
      .sort((a, b) => a.startMin - b.startMin);
  }

  function getWeekDates(weekStartStr) {
    const start = parseDateFromInput(weekStartStr);
    const result = [];

    for (let i = 0; i < 7; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      result.push(formatDateForInput(date));
    }

    return result;
  }

  function getWeekStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diffToMonday);
    return d;
  }

  function buildStartTimes() {
    const result = [];
    for (let minutes = DAY_START; minutes < DAY_END; minutes += STEP) {
      result.push(minutes);
    }
    return result;
  }

  function minutesToTime(minutes) {
    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  function durationLabel(minutes) {
    if (minutes === 30) return "30 мин";
    if (minutes === 60) return "1 час";
    if (minutes === 90) return "1.5 часа";
    if (minutes === 120) return "2 часа";
    if (minutes === 180) return "3 часа";
    return `${minutes} мин`;
  }

  function parseDateFromInput(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDateForInput(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDateLong(dateStr) {
    return new Intl.DateTimeFormat("ru-RU", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(parseDateFromInput(dateStr));
  }

  function formatDateLongShort(date) {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function formatDateShort(dateStr) {
    const d = parseDateFromInput(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}.${month}`;
  }

  async function apiRequest(url, options = {}) {
    let response;

    try {
      response = await fetch(url, {
        headers: {
          "Content-Type": "application/json"
        },
        ...options
      });
    } catch {
      if (window.location.protocol === "file:") {
        throw new Error("Сайт открыт не через сервер. Используйте Vercel-домен или локальный сервер.");
      }

      throw new Error("Сервер недоступен. Проверьте деплой Vercel и переменные окружения.");
    }

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await response.json() : {};

    if (!response.ok) {
      throw new Error(payload.error || "Ошибка запроса к серверу");
    }

    return payload;
  }

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(12px)";
      toast.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    }, 2300);

    setTimeout(() => {
      toast.remove();
    }, 2600);
  }
})();
