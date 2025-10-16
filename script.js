const languageSelect = document.getElementById('language-select');
const yearSelect = document.getElementById('year-select');
const navButtons = document.querySelectorAll('.main-nav__item');
const views = document.querySelectorAll('.view');
const calendarGrid = document.getElementById('calendar-grid');
const currentPeriodEl = document.getElementById('current-period');
const calendarViewSelect = document.getElementById('calendar-view');
const daySummary = document.getElementById('day-summary');
const dayExams = document.getElementById('day-exams');
const examCards = document.getElementById('exam-cards');
const exploreStudents = document.getElementById('explore-students');
const exploreForm = document.getElementById('explore-form');
const exploreThesis = document.getElementById('explore-thesis');
const exploreAdvisor = document.getElementById('explore-advisor');
const exploreType = document.getElementById('explore-type');
const exploreNewStudent = document.getElementById('explore-new-student');
const exploreAddStudent = document.getElementById('explore-add-student');
const exploreTableBody = document.getElementById('explore-table-body');
const searchForm = document.getElementById('search-form');
const searchStudentInput = document.getElementById('search-student');
const searchResults = document.getElementById('search-results');
const baseData = {
  advisors: [
    { id: 'aj-porn', nameTh: 'อ. ดร. พรทิพย์ วัฒนสวัสดิ์', nameEn: 'Asst. Prof. Dr. Porntip Wattanasawat' },
    { id: 'aj-som', nameTh: 'อ. สมชาย จิตรมณี', nameEn: 'Mr. Somchai Jitramanee' },
    { id: 'aj-suda', nameTh: 'ผศ. ดร. สุทา วราภรณ์', nameEn: 'Assoc. Prof. Dr. Suta Waraporn' },
    { id: 'aj-korn', nameTh: 'อ. กรวิชญ์ วัฒนะ', nameEn: 'Mr. Kornwitch Vatthana' },
  ],
  students: [
    'กนกวรรณ ศรีสวัสดิ์',
    'ชลธิชา เกษมสุข',
    'ณัฐกร บุญธรรม',
    'ธัญญาเรศ นาคินทร์',
    'ปาริฉัตร ชาญชัย',
    'วรภพ สุนทรวาที',
    'ศุภกฤต วัฒนกุล',
    'อภิรักษ์ เกียรติเดช',
  ],
};

const translations = {
  th: {
    appTitle: 'ระบบปริญญานิพนธ์',
    appSubtitle: 'Faculty Thesis Portal',
    navHome: 'หน้าแรก',
    navExplore: 'หน้าสำรวจหัวข้อ',
    navOpen: 'หน้าลงทะเบียนสอบเปิดหัวข้อ',
    navClose: 'หน้าลงทะเบียนสอบปิดหัวข้อ',
    navThesis: 'หน้าลงทะเบียนปริญญานิพนธ์',
    languageLabel: 'ภาษา',
    yearLabel: 'ปีการศึกษา (พ.ศ.)',
    homeTitle: 'ภาพรวมการสอบปริญญานิพนธ์',
    homeSubtitle: 'ตรวจสอบกำหนดการสอบในรูปแบบวัน สัปดาห์ หรือเดือน',
    calendarViewLabel: 'แสดงผลปฏิทิน',
    calendarMonth: 'มุมมองเดือน',
    calendarWeek: 'มุมมองสัปดาห์',
    calendarDay: 'มุมมองวัน',
    dayViewTitle: 'รายละเอียดวันสอบ',
    examListTitle: 'กำหนดการสอบทั้งหมดในปีการศึกษานี้',
    exploreTitle: 'ลงทะเบียนเพื่อสำรวจหัวข้อ',
    exploreSubtitle: 'แจ้งความสนใจหัวข้อและอาจารย์ที่ปรึกษา',
    exploreFormTitle: 'บันทึกความสนใจ',
    exploreStudentsLabel: 'รายชื่อนักศึกษา',
    exploreStudentsPlaceholder: 'เลือกหลายรายชื่อ',
    exploreStudentsHint: 'กดค้างที่ Ctrl / Command เพื่อเลือกหลายชื่อ หรือพิมพ์ชื่อใหม่แล้วกดปุ่มเพิ่มชื่อ',
    exploreThesisLabel: 'หัวข้อปริญญานิพนธ์ที่สนใจ',
    exploreAdvisorLabel: 'อาจารย์ที่ปรึกษาที่สนใจ',
    exploreTypeLabel: 'ประเภทปริญญานิพนธ์',
    thesisTypeStill: 'ภาพนิ่ง',
    thesisTypeMotion: 'ภาพเคลื่อนไหว',
    thesisTypeAudio: 'เสียง',
    thesisTypeContent: 'คอนเทนต์',
    exploreNewStudentPlaceholder: 'เพิ่มชื่อใหม่ที่นี่',
    saveInterest: 'บันทึกความสนใจ',
    clearForm: 'ล้างข้อมูล',
    exploreManageTitle: 'ตรวจสอบ/แก้ไขข้อมูล',
    searchLabel: 'ค้นหาด้วยชื่อนักศึกษา',
    searchButton: 'ค้นหา',
    searchHint: 'กรอกชื่อเพื่อค้นหาข้อมูลที่เกี่ยวข้อง',
    searchPlaceholder: 'พิมพ์ชื่อนักศึกษา',
    exploreListTitle: 'รายการความสนใจในปีการศึกษาที่เลือก',
    exploreListSubtitle: 'แก้ไขหรืออัปเดตข้อมูลได้ตลอดเวลา',
    tableThesis: 'หัวข้อ',
    tableStudents: 'รายชื่อนักศึกษา',
    tableAdvisor: 'อาจารย์ที่ปรึกษา',
    tableType: 'ประเภท',
    tableActions: 'การจัดการ',
    edit: 'แก้ไข',
    remove: 'ลบ',
    deleteRecord: 'ลบรายการ',
    updateRecord: 'อัปเดตข้อมูล',
    noExamsToday: 'วันนี้ไม่มีการสอบปริญญานิพนธ์',
    openExam: 'สอบเปิดหัวข้อ',
    closeExam: 'สอบปิดหัวข้อ',
    room: 'ห้องสอบ',
    time: 'เวลา',
    timeSuffix: 'น.',
    advisor: 'อาจารย์ที่ปรึกษา',
    students: 'นักศึกษา',
    thesisTitle: 'หัวข้อปริญญานิพนธ์',
    underConstructionTitle: 'อยู่ระหว่างปรับปรุง',
    underConstructionText: 'ฟีเจอร์นี้กำลังถูกพัฒนา',
    searchNoResult: 'ไม่พบข้อมูลที่เกี่ยวข้อง',
    addStudent: 'เพิ่มชื่อ',
    placeholderAddStudent: 'พิมพ์ชื่อแล้วกด Enter',
    cancel: 'ยกเลิก',
    save: 'บันทึก',
    removeSelf: 'ลบชื่อของฉัน',
    confirmDelete: 'คุณต้องการลบรายการนี้หรือไม่?',
  },
  en: {
    appTitle: 'Thesis Portal',
    appSubtitle: 'Faculty Thesis Portal',
    navHome: 'Home',
    navExplore: 'Topic Exploration',
    navOpen: 'Open Defense Registration',
    navClose: 'Close Defense Registration',
    navThesis: 'Thesis Registration',
    languageLabel: 'Language',
    yearLabel: 'Academic Year (B.E.)',
    homeTitle: 'Thesis Examination Overview',
    homeSubtitle: 'Track examination schedules in day, week or month view',
    calendarViewLabel: 'Calendar view',
    calendarMonth: 'Month view',
    calendarWeek: 'Week view',
    calendarDay: 'Day view',
    dayViewTitle: 'Day details',
    examListTitle: 'All examinations in the selected academic year',
    exploreTitle: 'Register to Explore Topics',
    exploreSubtitle: 'Submit your interests for topics and advisors',
    exploreFormTitle: 'Interest submission',
    exploreStudentsLabel: 'Student names',
    exploreStudentsPlaceholder: 'Select multiple students',
    exploreStudentsHint: 'Hold Ctrl / Command to select multiple names or type a new name then press Add',
    exploreThesisLabel: 'Interested thesis topic',
    exploreAdvisorLabel: 'Preferred advisor',
    exploreTypeLabel: 'Thesis format',
    thesisTypeStill: 'Still image',
    thesisTypeMotion: 'Motion picture',
    thesisTypeAudio: 'Audio',
    thesisTypeContent: 'Content',
    exploreNewStudentPlaceholder: 'Add a new name here',
    saveInterest: 'Save interest',
    clearForm: 'Clear form',
    exploreManageTitle: 'Check or edit records',
    searchLabel: 'Search by student name',
    searchButton: 'Search',
    searchHint: 'Enter a name to see related records',
    searchPlaceholder: 'Type a student name',
    exploreListTitle: 'Interest submissions for the selected academic year',
    exploreListSubtitle: 'You can update entries at any time',
    tableThesis: 'Topic',
    tableStudents: 'Students',
    tableAdvisor: 'Advisor',
    tableType: 'Format',
    tableActions: 'Actions',
    edit: 'Edit',
    remove: 'Remove',
    deleteRecord: 'Delete record',
    updateRecord: 'Update entry',
    noExamsToday: 'No thesis examinations today',
    openExam: 'Open defense',
    closeExam: 'Close defense',
    room: 'Room',
    time: 'Time',
    timeSuffix: '',
    advisor: 'Advisor',
    students: 'Students',
    thesisTitle: 'Thesis topic',
    underConstructionTitle: 'Under construction',
    underConstructionText: 'This feature is currently being developed.',
    searchNoResult: 'No related records found',
    addStudent: 'Add name',
    placeholderAddStudent: 'Type a name and press Enter',
    cancel: 'Cancel',
    save: 'Save',
    removeSelf: 'Remove my name',
    confirmDelete: 'Do you want to delete this entry?',
  },
};

const thesisTypeLabels = {
  still: { th: 'ภาพนิ่ง', en: 'Still image' },
  motion: { th: 'ภาพเคลื่อนไหว', en: 'Motion picture' },
  audio: { th: 'เสียง', en: 'Audio' },
  content: { th: 'คอนเทนต์', en: 'Content' },
};

let currentLanguage = 'th';
let currentAcademicYear = 2568;
let currentDate = new Date('2025-02-17');
let selectedDate = new Date(currentDate);
let calendarViewMode = 'month';
let exploreEntries = [];

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const events = [
  {
    id: 'ev-001',
    thesisTitle: 'การออกแบบระบบปัญญาประดิษฐ์เพื่อช่วยบรรณาธิการ',
    students: ['กนกวรรณ ศรีสวัสดิ์', 'ชลธิชา เกษมสุข'],
    advisor: 'อ. ดร. พรทิพย์ วัฒนสวัสดิ์',
    advisorEn: 'Asst. Prof. Dr. Porntip Wattanasawat',
    examType: 'open',
    start: '2025-02-17T09:30',
    end: '2025-02-17T11:30',
    room: 'ห้องสตูดิโอ 4',
    academicYear: 2568,
  },
  {
    id: 'ev-002',
    thesisTitle: 'การสร้างคอนเทนต์เสียงเชิงโต้ตอบ',
    students: ['ณัฐกร บุญธรรม'],
    advisor: 'ผศ. ดร. สุทา วราภรณ์',
    advisorEn: 'Assoc. Prof. Dr. Suta Waraporn',
    examType: 'close',
    start: '2025-02-20T13:00',
    end: '2025-02-20T14:30',
    room: 'ห้องประชุม 2',
    academicYear: 2568,
  },
  {
    id: 'ev-003',
    thesisTitle: 'สื่อภาพนิ่งเพื่อการสื่อสารด้านสิ่งแวดล้อม',
    students: ['ธัญญาเรศ นาคินทร์', 'ปาริฉัตร ชาญชัย'],
    advisor: 'อ. สมชาย จิตรมณี',
    advisorEn: 'Mr. Somchai Jitramanee',
    examType: 'open',
    start: '2025-03-05T10:00',
    end: '2025-03-05T12:00',
    room: 'ห้องนิทรรศการ A',
    academicYear: 2568,
  },
  {
    id: 'ev-004',
    thesisTitle: 'ภาพเคลื่อนไหวเพื่อการเล่าเรื่องชุมชน',
    students: ['วรภพ สุนทรวาที'],
    advisor: 'อ. กรวิชญ์ วัฒนะ',
    advisorEn: 'Mr. Kornwitch Vatthana',
    examType: 'close',
    start: '2026-02-10T09:00',
    end: '2026-02-10T10:30',
    room: 'ห้องสื่อสร้างสรรค์',
    academicYear: 2569,
  },
];

const eventYears = [...new Set(events.map((e) => e.academicYear))].sort();

function ensureYearOption(year) {
  const existingYears = [...yearSelect.options].map((opt) => Number(opt.value));
  if (!existingYears.includes(year)) {
    existingYears.push(year);
    existingYears.sort((a, b) => a - b);
    const previous = yearSelect.value ? Number(yearSelect.value) : null;
    yearSelect.innerHTML = '';
    existingYears.forEach((yr) => {
      const option = document.createElement('option');
      option.value = String(yr);
      option.textContent = yr;
      if (previous === yr) {
        option.selected = true;
      }
      yearSelect.appendChild(option);
    });
  }
}

eventYears.forEach((year) => ensureYearOption(year));

if (eventYears.length && !eventYears.includes(currentAcademicYear)) {
  currentAcademicYear = eventYears[eventYears.length - 1];
}

yearSelect.value = String(currentAcademicYear);

function formatDate(date, options = {}) {
  const formatter = new Intl.DateTimeFormat(`${currentLanguage === 'th' ? 'th-TH' : 'en-US'}-u-ca-buddhist`, options);
  return formatter.format(date);
}

function formatTimeRange(startStr, endStr) {
  const opts = { hour: '2-digit', minute: '2-digit', hour12: false };
  const locale = currentLanguage === 'th' ? 'th-TH' : 'en-US';
  const start = new Intl.DateTimeFormat(`${locale}-u-ca-buddhist`, opts).format(new Date(startStr));
  const end = new Intl.DateTimeFormat(`${locale}-u-ca-buddhist`, opts).format(new Date(endStr));
  const suffix = translations[currentLanguage].timeSuffix ? ` ${translations[currentLanguage].timeSuffix}` : '';
  return `${start} - ${end}${suffix}`;
}

function localizeExamType(type) {
  if (type === 'open') {
    return translations[currentLanguage].openExam;
  }
  return translations[currentLanguage].closeExam;
}

function getAdvisorName(advisorTh, advisorEn) {
  return currentLanguage === 'th' ? advisorTh : advisorEn || advisorTh;
}

function convertToDate(dateStr) {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getMonthName(date) {
  const options = { month: 'long', year: 'numeric' };
  return formatDate(date, options);
}

function getWeekRange(date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  start.setDate(start.getDate() + diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${formatDate(start, { day: 'numeric', month: 'long' })} - ${formatDate(end, { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

function renderCalendar() {
  calendarGrid.innerHTML = '';
  calendarGrid.className = 'calendar-grid';
  const eventsOfYear = events.filter((event) => event.academicYear === currentAcademicYear);
  const eventByDate = eventsOfYear.reduce((acc, event) => {
    const dateKey = event.start.split('T')[0];
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {});

  if (calendarViewMode === 'month') {
    calendarGrid.classList.add('calendar-grid--month');
    const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const firstDayWeekday = (firstDay.getDay() + 6) % 7; // Monday first
    const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    const prevMonthDays = firstDayWeekday;
    const totalCells = Math.ceil((prevMonthDays + daysInMonth) / 7) * 7;
    const currentMonth = firstDay.getMonth();

    for (let i = 0; i < totalCells; i += 1) {
      const cellDate = new Date(firstDay);
      cellDate.setDate(cellDate.getDate() - prevMonthDays + i);
      const dateKey = cellDate.toISOString().split('T')[0];
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'calendar-cell';
      if (cellDate.getMonth() !== currentMonth) {
        cell.classList.add('calendar-cell--muted');
      }
      if (dateKey === selectedDate.toISOString().split('T')[0]) {
        cell.classList.add('is-selected');
      }
      cell.innerHTML = `
        <span class="calendar-cell__date">${cellDate.getDate()}</span>
        <div class="calendar-cell__events">
          ${(eventByDate[dateKey] || [])
            .map((event) => `<span>${localizeExamType(event.examType)}</span>`)
            .join('')}
        </div>
      `;
      cell.addEventListener('click', () => {
        selectedDate = new Date(cellDate);
        renderCalendar();
        renderDayPanel();
      });
      calendarGrid.appendChild(cell);
    }
    currentPeriodEl.textContent = getMonthName(selectedDate);
  } else if (calendarViewMode === 'week') {
    calendarGrid.classList.add('calendar-grid--week');
    const start = new Date(selectedDate);
    const day = start.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    start.setDate(start.getDate() + diff);
    for (let i = 0; i < 7; i += 1) {
      const cellDate = new Date(start);
      cellDate.setDate(start.getDate() + i);
      const dateKey = cellDate.toISOString().split('T')[0];
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'calendar-cell';
      if (dateKey === selectedDate.toISOString().split('T')[0]) {
        cell.classList.add('is-selected');
      }
      cell.innerHTML = `
        <span class="calendar-cell__date">${formatDate(cellDate, { weekday: 'short', day: 'numeric' })}</span>
        <div class="calendar-cell__events">
          ${(eventByDate[dateKey] || [])
            .map((event) => `<span>${localizeExamType(event.examType)}</span>`)
            .join('')}
        </div>
      `;
      cell.addEventListener('click', () => {
        selectedDate = new Date(cellDate);
        renderCalendar();
        renderDayPanel();
      });
      calendarGrid.appendChild(cell);
    }
    currentPeriodEl.textContent = getWeekRange(selectedDate);
  } else {
    calendarGrid.classList.add('calendar-grid--day');
    const dateKey = selectedDate.toISOString().split('T')[0];
    const cell = document.createElement('div');
    cell.className = 'calendar-cell is-selected';
    cell.innerHTML = `
      <span class="calendar-cell__date">${formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
      <div class="calendar-cell__events">
        ${(eventByDate[dateKey] || [])
          .map((event) => `<span>${localizeExamType(event.examType)} • ${formatTimeRange(event.start, event.end)}</span>`)
          .join('')}
      </div>
    `;
    calendarGrid.appendChild(cell);
    currentPeriodEl.textContent = formatDate(selectedDate, { day: 'numeric', month: 'long', year: 'numeric' });
  }
}

function renderDayPanel() {
  const selectedKey = selectedDate.toISOString().split('T')[0];
  const eventsOfYear = events.filter((event) => event.academicYear === currentAcademicYear);
  const todaysEvents = eventsOfYear.filter((event) => event.start.startsWith(selectedKey));
  if (!todaysEvents.length) {
    daySummary.textContent = translations[currentLanguage].noExamsToday;
    dayExams.innerHTML = `<div class="day-empty-date">${formatDate(selectedDate, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}</div>`;
    return;
  }

  daySummary.textContent = formatDate(selectedDate, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  dayExams.innerHTML = todaysEvents
    .map((event) => {
      const advisorName = getAdvisorName(event.advisor, event.advisorEn);
      const studentList = event.students.join(', ');
      return `
        <article class="day-exam-card">
          <div class="day-exam-card__header">
            <h4 class="day-exam-card__title">${event.thesisTitle}</h4>
            <span class="badge ${event.examType === 'open' ? 'badge--open' : 'badge--close'}">${localizeExamType(event.examType)}</span>
          </div>
          <div class="day-exam-card__body">
            <div>${translations[currentLanguage].time}: ${formatTimeRange(event.start, event.end)}</div>
            <div>${translations[currentLanguage].room}: ${event.room}</div>
            <div>${translations[currentLanguage].advisor}: ${advisorName}</div>
            <div>${translations[currentLanguage].students}: ${studentList}</div>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderExamCards() {
  const eventsOfYear = events.filter((event) => event.academicYear === currentAcademicYear);
  if (!eventsOfYear.length) {
    examCards.innerHTML = `<div>${translations[currentLanguage].searchNoResult}</div>`;
    return;
  }
  examCards.innerHTML = eventsOfYear
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .map((event) => {
      const advisorName = getAdvisorName(event.advisor, event.advisorEn);
      return `
        <article class="exam-card">
          <div class="exam-card__header">
            <h4 class="exam-card__title">${event.thesisTitle}</h4>
            <span class="badge ${event.examType === 'open' ? 'badge--open' : 'badge--close'}">${localizeExamType(event.examType)}</span>
          </div>
          <div>${formatDate(new Date(event.start), { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div>${translations[currentLanguage].time}: ${formatTimeRange(event.start, event.end)}</div>
          <div>${translations[currentLanguage].room}: ${event.room}</div>
          <div>${translations[currentLanguage].advisor}: ${advisorName}</div>
          <div>${translations[currentLanguage].students}: ${event.students.join(', ')}</div>
        </article>
      `;
    })
    .join('');
}

function renderAdvisorOptions() {
  exploreAdvisor.innerHTML = '';
  baseData.advisors.forEach((advisor) => {
    const option = document.createElement('option');
    option.value = advisor.id;
    option.textContent = currentLanguage === 'th' ? advisor.nameTh : advisor.nameEn;
    exploreAdvisor.appendChild(option);
  });
}

function ensureStudentOption(name) {
  const exists = [...exploreStudents.options].some((opt) => opt.value === name);
  if (!exists) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    exploreStudents.appendChild(option);
  }
}

function renderStudentOptions() {
  const selectedValues = [...exploreStudents.selectedOptions].map((opt) => opt.value);
  exploreStudents.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.textContent = translations[currentLanguage].exploreStudentsPlaceholder;
  exploreStudents.appendChild(placeholder);
  baseData.students.forEach((student) => {
    ensureStudentOption(student);
  });
  [...exploreStudents.options].forEach((option) => {
    option.selected = selectedValues.includes(option.value);
  });
}

function getAdvisorDisplayById(id) {
  const advisor = baseData.advisors.find((a) => a.id === id);
  if (!advisor) return id;
  return currentLanguage === 'th' ? advisor.nameTh : advisor.nameEn;
}

function upsertExploreEntry(entry) {
  const existingIndex = exploreEntries.findIndex((item) => item.id === entry.id);
  if (existingIndex >= 0) {
    exploreEntries[existingIndex] = entry;
  } else {
    exploreEntries.push(entry);
  }
  renderExploreTable();
}

function renderExploreTable() {
  const entriesOfYear = exploreEntries.filter((entry) => entry.academicYear === currentAcademicYear);
  if (!entriesOfYear.length) {
    exploreTableBody.innerHTML = `<tr><td colspan="5">${translations[currentLanguage].searchNoResult}</td></tr>`;
    return;
  }
  exploreTableBody.innerHTML = entriesOfYear
    .map((entry) => {
      const typeLabel = thesisTypeLabels[entry.thesisType]?.[currentLanguage] ?? entry.thesisType;
      const advisorName = getAdvisorDisplayById(entry.advisorId);
      return `
        <tr data-entry-id="${entry.id}">
          <td>${entry.thesisTitle}</td>
          <td>${entry.students.join('<br />')}</td>
          <td>${advisorName}</td>
          <td>${typeLabel}</td>
          <td>
            <div class="table-actions">
              <button class="secondary-button" data-action="edit">${translations[currentLanguage].edit}</button>
              <button class="secondary-button" data-action="delete">${translations[currentLanguage].deleteRecord}</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function handleExploreFormSubmit(event) {
  event.preventDefault();
  const selectedOptions = [...exploreStudents.selectedOptions].map((opt) => opt.value).filter(Boolean);
  if (!selectedOptions.length) return;
  const entry = {
    id: createId(),
    thesisTitle: exploreThesis.value.trim(),
    students: selectedOptions,
    advisorId: exploreAdvisor.value,
    thesisType: exploreType.value,
    academicYear: currentAcademicYear,
  };
  upsertExploreEntry(entry);
  exploreForm.reset();
  exploreNewStudent.value = '';
  exploreStudents.selectedIndex = -1;
}

function renderSearchResults(name) {
  if (!name) {
    searchResults.innerHTML = `<div>${translations[currentLanguage].searchHint}</div>`;
    return;
  }
  const results = exploreEntries.filter((entry) => entry.students.some((student) => student.includes(name)));
  if (!results.length) {
    searchResults.innerHTML = `<div>${translations[currentLanguage].searchNoResult}</div>`;
    return;
  }

  searchResults.innerHTML = results
    .map((entry) => {
      const typeLabel = thesisTypeLabels[entry.thesisType]?.[currentLanguage] ?? entry.thesisType;
      const advisorName = getAdvisorDisplayById(entry.advisorId);
      const studentTags = entry.students
        .map(
          (student) => `
          <span class="tag">
            ${student}
            <button type="button" data-action="remove-student" data-student="${student}" data-entry="${entry.id}">×</button>
          </span>
        `,
        )
        .join('');
      return `
        <article class="search-result-card" data-entry-id="${entry.id}">
          <header>
            <h4>${translations[currentLanguage].thesisTitle}: ${entry.thesisTitle}</h4>
            <p>${translations[currentLanguage].advisor}: ${advisorName}</p>
          </header>
          <div>
            <div>${translations[currentLanguage].tableType}: ${typeLabel}</div>
            <div class="student-tags">${studentTags}</div>
          </div>
          <form class="form edit-form">
            <div class="form__row">
              <label>${translations[currentLanguage].thesisTitle}</label>
              <input type="text" name="thesisTitle" value="${entry.thesisTitle}" required />
            </div>
            <div class="form__row">
              <label>${translations[currentLanguage].tableAdvisor}</label>
              <select name="advisorId">
                ${baseData.advisors
                  .map(
                    (advisor) => `
                    <option value="${advisor.id}" ${advisor.id === entry.advisorId ? 'selected' : ''}>
                      ${currentLanguage === 'th' ? advisor.nameTh : advisor.nameEn}
                    </option>
                  `,
                  )
                  .join('')}
              </select>
            </div>
            <div class="form__row">
              <label>${translations[currentLanguage].tableType}</label>
              <select name="thesisType">
                ${Object.entries(thesisTypeLabels)
                  .map(
                    ([value, label]) => `
                    <option value="${value}" ${value === entry.thesisType ? 'selected' : ''}>
                      ${label[currentLanguage]}
                    </option>
                  `,
                  )
                  .join('')}
              </select>
            </div>
            <div class="form__row">
              <label>${translations[currentLanguage].addStudent}</label>
              <input type="text" name="newStudent" placeholder="${translations[currentLanguage].placeholderAddStudent}" />
            </div>
            <div class="form__actions">
              <button type="submit" class="primary-button">${translations[currentLanguage].save}</button>
              <button type="button" class="ghost-button" data-action="remove-self" data-entry="${entry.id}" data-name="${name}">${translations[currentLanguage].removeSelf}</button>
            </div>
          </form>
        </article>
      `;
    })
    .join('');
}

function updateTexts() {
  document.documentElement.lang = currentLanguage === 'th' ? 'th' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    const translation = translations[currentLanguage][key];
    if (translation) {
      element.textContent = translation;
    }
  });

  [...document.querySelectorAll('#calendar-view option')].forEach((option) => {
    const key = option.dataset.i18n;
    option.textContent = translations[currentLanguage][key];
  });

  if (exploreNewStudent) {
    exploreNewStudent.placeholder = translations[currentLanguage].exploreNewStudentPlaceholder;
  }
  if (searchStudentInput) {
    searchStudentInput.placeholder = translations[currentLanguage].searchPlaceholder;
  }

  renderAdvisorOptions();
  renderStudentOptions();
  renderExploreTable();
  renderSearchResults(searchStudentInput.value.trim());
  renderCalendar();
  renderDayPanel();
  renderExamCards();
}

languageSelect.addEventListener('change', () => {
  currentLanguage = languageSelect.value;
  updateTexts();
});

navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    navButtons.forEach((btn) => btn.classList.remove('is-active'));
    button.classList.add('is-active');
    const targetId = button.dataset.target;
    views.forEach((view) => view.classList.remove('is-active'));
    const target = document.getElementById(targetId);
    if (target) target.classList.add('is-active');
  });
});

yearSelect.addEventListener('change', () => {
  currentAcademicYear = Number(yearSelect.value);
  const eventsOfYear = events.filter((event) => event.academicYear === currentAcademicYear);
  if (eventsOfYear.length) {
    selectedDate = new Date(eventsOfYear[0].start);
  } else {
    selectedDate = new Date(currentAcademicYear - 543, 0, 15);
  }
  renderCalendar();
  renderDayPanel();
  renderExamCards();
  renderExploreTable();
});

calendarViewSelect.addEventListener('change', () => {
  calendarViewMode = calendarViewSelect.value;
  renderCalendar();
});

function movePeriod(step) {
  if (calendarViewMode === 'month') {
    selectedDate.setMonth(selectedDate.getMonth() + step);
  } else if (calendarViewMode === 'week') {
    selectedDate.setDate(selectedDate.getDate() + step * 7);
  } else {
    selectedDate.setDate(selectedDate.getDate() + step);
  }
  renderCalendar();
  renderDayPanel();
}

document.getElementById('prev-period').addEventListener('click', () => movePeriod(-1));
document.getElementById('next-period').addEventListener('click', () => movePeriod(1));

exploreForm.addEventListener('submit', handleExploreFormSubmit);

exploreAddStudent.addEventListener('click', () => {
  const name = exploreNewStudent.value.trim();
  if (!name) return;
  if (!baseData.students.includes(name)) {
    baseData.students.push(name);
  }
  ensureStudentOption(name);
  [...exploreStudents.options].forEach((option) => {
    if (option.value === name) {
      option.selected = true;
    }
  });
  exploreNewStudent.value = '';
});

exploreNewStudent.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    exploreAddStudent.click();
  }
});

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = searchStudentInput.value.trim();
  if (!name) return;
  renderSearchResults(name);
});

searchResults.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const entryId = button.dataset.entry;
  const entryIndex = exploreEntries.findIndex((entry) => entry.id === entryId);
  if (entryIndex < 0) return;

  if (button.dataset.action === 'remove-student') {
    const studentName = button.dataset.student;
    exploreEntries[entryIndex].students = exploreEntries[entryIndex].students.filter((student) => student !== studentName);
    if (!exploreEntries[entryIndex].students.length) {
      exploreEntries.splice(entryIndex, 1);
    }
    renderSearchResults(searchStudentInput.value.trim());
    renderExploreTable();
  } else if (button.dataset.action === 'remove-self') {
    const studentName = button.dataset.name;
    exploreEntries[entryIndex].students = exploreEntries[entryIndex].students.filter((student) => student !== studentName);
    if (!exploreEntries[entryIndex].students.length) {
      exploreEntries.splice(entryIndex, 1);
    }
    renderSearchResults(searchStudentInput.value.trim());
    renderExploreTable();
  }
});

searchResults.addEventListener('submit', (event) => {
  if (!event.target.classList.contains('edit-form')) return;
  event.preventDefault();
  const form = event.target;
  const entryId = form.closest('[data-entry-id]').dataset.entryId;
  const entryIndex = exploreEntries.findIndex((entry) => entry.id === entryId);
  if (entryIndex < 0) return;
  const data = new FormData(form);
  const thesisTitle = data.get('thesisTitle').toString().trim();
  const advisorId = data.get('advisorId').toString();
  const thesisType = data.get('thesisType').toString();
  const newStudent = data.get('newStudent').toString().trim();
  if (newStudent) {
    ensureStudentOption(newStudent);
    if (!exploreEntries[entryIndex].students.includes(newStudent)) {
      exploreEntries[entryIndex].students.push(newStudent);
    }
    form.querySelector('[name="newStudent"]').value = '';
  }
  exploreEntries[entryIndex] = {
    ...exploreEntries[entryIndex],
    thesisTitle,
    advisorId,
    thesisType,
  };
  renderSearchResults(searchStudentInput.value.trim());
  renderExploreTable();
});

exploreTableBody.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const row = button.closest('tr');
  const entryId = row?.dataset.entryId;
  if (!entryId) return;
  const index = exploreEntries.findIndex((entry) => entry.id === entryId);
  if (index < 0) return;

  if (button.dataset.action === 'delete') {
    if (confirm(translations[currentLanguage].confirmDelete)) {
      exploreEntries.splice(index, 1);
      renderExploreTable();
      renderSearchResults(searchStudentInput.value.trim());
    }
  } else if (button.dataset.action === 'edit') {
    searchStudentInput.value = '';
    renderSearchResults('');
    const entry = exploreEntries[index];
    exploreThesis.value = entry.thesisTitle;
    exploreAdvisor.value = entry.advisorId;
    exploreType.value = entry.thesisType;
    [...exploreStudents.options].forEach((option) => {
      option.selected = entry.students.includes(option.value);
    });
    const exploreViewButton = document.querySelector('.main-nav__item[data-target="explore"]');
    exploreViewButton.click();
  }
});

function seedExploreEntries() {
  const initialEntries = [
    {
      id: createId(),
      thesisTitle: 'ประสบการณ์ภาพนิ่งสำหรับพิพิธภัณฑ์ท้องถิ่น',
      students: ['ศุภกฤต วัฒนกุล', 'อภิรักษ์ เกียรติเดช'],
      advisorId: 'aj-porn',
      thesisType: 'still',
      academicYear: 2568,
    },
    {
      id: createId(),
      thesisTitle: 'สื่อเสียงเพื่อการท่องเที่ยวชุมชน',
      students: ['ชลธิชา เกษมสุข'],
      advisorId: 'aj-suda',
      thesisType: 'audio',
      academicYear: 2568,
    },
    {
      id: createId(),
      thesisTitle: 'วิดีโอสารคดีเล่าเรื่องผู้สูงวัย',
      students: ['วรภพ สุนทรวาที'],
      advisorId: 'aj-korn',
      thesisType: 'motion',
      academicYear: 2569,
    },
  ];
  exploreEntries = initialEntries;
}

function initializeYearOptions() {
  exploreEntries.forEach((entry) => ensureYearOption(entry.academicYear));
}

function init() {
  seedExploreEntries();
  initializeYearOptions();
  renderAdvisorOptions();
  renderStudentOptions();
  renderExploreTable();
  renderCalendar();
  renderDayPanel();
  renderExamCards();
  languageSelect.value = currentLanguage;
  updateTexts();
}

init();
