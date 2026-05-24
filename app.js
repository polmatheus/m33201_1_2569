// app.js

let supabaseClient = null;
let currentStudents = [];
let currentMode = 'attendance';

function initSupabase() {
    try {
        if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_KEY === 'undefined') {
            alert("❌ ไม่พบไฟล์ config.js");
            return false;
        }
        if (!supabaseClient) {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }
        return true;
    } catch (error) {
        alert("❌ โหลด Supabase ไม่สำเร็จ: " + error.message);
        return false;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    try {
        const dateInput = document.getElementById('dateSelect');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    } catch(e) {
        console.error("Date setting error:", e);
    }
});

// สลับโหมด
function setMode(mode) {
    currentMode = mode;
    const tabAtt = document.getElementById('tabAttendance');
    const tabScore = document.getElementById('tabScore');
    const scoreFields = document.getElementById('scoreFieldsContainer');
    const topicField = document.getElementById('topicFieldContainer');
    const btnSelectAll = document.getElementById('btnSelectAll');
    
    document.getElementById('tableContainer').style.display = 'none';
    document.getElementById('action-bar').classList.add('translate-y-full');
    btnSelectAll.style.display = 'none';

    if (mode === 'attendance') {
        tabAtt.className = 'tab-active flex-1 py-3 text-sm md:text-base transition-all duration-200';
        tabScore.className = 'tab-inactive flex-1 py-3 text-sm md:text-base transition-all duration-200 hover:text-slate-700';
        scoreFields.classList.add('hidden');
        topicField.classList.add('hidden');
        btnSelectAll.innerHTML = '✅ มาเรียนทุกคน';
        btnSelectAll.className = 'flex-1 bg-white text-slate-700 h-14 rounded-2xl font-semibold hover:bg-slate-50 active:bg-slate-100 transition-all border border-slate-200 shadow-sm text-base';
    } else {
        tabScore.className = 'tab-active flex-1 py-3 text-sm md:text-base transition-all duration-200';
        tabAtt.className = 'tab-inactive flex-1 py-3 text-sm md:text-base transition-all duration-200 hover:text-slate-700';
        scoreFields.classList.remove('hidden');
        topicField.classList.remove('hidden');
        btnSelectAll.innerHTML = '⚡️ กรอกคะแนนเดียวกันทุกคน';
        btnSelectAll.className = 'flex-1 bg-indigo-50 text-indigo-700 h-14 rounded-2xl font-semibold hover:bg-indigo-100 active:bg-indigo-200 transition-all border border-indigo-200 text-base';
    }
}

// เลือกทั้งหมด
function actionSelectAll() {
    if (currentMode === 'attendance') {
        document.querySelectorAll('.radio-present').forEach(radio => radio.checked = true);
    } else {
        const score = prompt("กรุณากรอกคะแนนที่ต้องการให้ทุกคน:");
        if (score !== null && score.trim() !== "") {
            document.querySelectorAll('.student-score').forEach(input => input.value = score);
        }
    }
}

// โหลดรายชื่อ
async function loadStudents() {
    if (!initSupabase()) return;

    const room = document.getElementById('roomSelect').value;
    const period = document.getElementById('periodSelect').value;
    const date = document.getElementById('dateSelect').value;

    if (!room || !period || !date) {
        alert("⚠️ กรุณาเลือก วันที่, ห้องเรียน และ คาบเรียน ให้ครบถ้วน");
        return;
    }

    const tbody = document.getElementById('studentTableBody');
    const thead = document.getElementById('tableHeader');
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center p-8 text-slate-500 font-medium animate-pulse">กำลังโหลดข้อมูล...</td></tr>';
    document.getElementById('tableContainer').style.display = 'block';
    
    try {
        const { data, error } = await supabaseClient
            .from('students_m33201_1_2569') 
            .select('*')
            .eq('room', room)
            .order('room_num', { ascending: true });

        if (error) throw error;
        currentStudents = data;
        tbody.innerHTML = '';

        if (currentStudents.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-red-500 font-medium bg-red-50">ไม่พบรายชื่อนักเรียนห้อง ${room}</td></tr>`;
            document.getElementById('action-bar').classList.add('translate-y-full');
            document.getElementById('btnSelectAll').style.display = 'none';
            return;
        }

        document.getElementById('action-bar').classList.remove('translate-y-full');
        document.getElementById('btnSelectAll').style.display = 'block';
        updateStatus('พร้อมบันทึกข้อมูล', 'slate');

        if (currentMode === 'attendance') {
            thead.innerHTML = `
                <tr>
                    <th class="p-4 font-semibold text-center w-12 rounded-tl-2xl">ที่</th>
                    <th class="p-4 font-semibold w-20 hidden md:table-cell">รหัส</th>
                    <th class="p-4 font-semibold">ชื่อ - นามสกุล</th>
                    <th class="p-4 font-semibold text-center min-w-[240px] rounded-tr-2xl">สถานะการเข้าเรียน</th>
                </tr>
            `;
        } else {
            thead.innerHTML = `
                <tr>
                    <th class="p-4 font-semibold text-center w-12 rounded-tl-2xl">ที่</th>
                    <th class="p-4 font-semibold w-20 hidden md:table-cell">รหัส</th>
                    <th class="p-4 font-semibold">ชื่อ - นามสกุล</th>
                    <th class="p-4 font-semibold text-center w-32 rounded-tr-2xl">คะแนน</th>
                </tr>
            `;
        }

        currentStudents.forEach((student, index) => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition-colors duration-150 group";
            
            let actionHtml = '';
            if (currentMode === 'attendance') {
                actionHtml = `
                    <td class="p-3 align-middle text-center flex justify-center gap-4 md:gap-6">
                        <label class="cursor-pointer flex flex-col items-center group/radio">
                            <input type="radio" name="status_${index}" value="มา" class="radio-present w-6 h-6 mb-1 cursor-pointer accent-emerald-500">
                            <span class="text-xs font-medium text-slate-400 group-hover/radio:text-emerald-600 transition-colors">มา</span>
                        </label>
                        <label class="cursor-pointer flex flex-col items-center group/radio">
                            <input type="radio" name="status_${index}" value="ขาด" class="w-6 h-6 mb-1 cursor-pointer accent-rose-500">
                            <span class="text-xs font-medium text-slate-400 group-hover/radio:text-rose-600 transition-colors">ขาด</span>
                        </label>
                        <label class="cursor-pointer flex flex-col items-center group/radio">
                            <input type="radio" name="status_${index}" value="ลา" class="w-6 h-6 mb-1 cursor-pointer accent-amber-500">
                            <span class="text-xs font-medium text-slate-400 group-hover/radio:text-amber-600 transition-colors">ลา</span>
                        </label>
                        <label class="cursor-pointer flex flex-col items-center group/radio">
                            <input type="radio" name="status_${index}" value="สาย" class="w-6 h-6 mb-1 cursor-pointer accent-orange-500">
                            <span class="text-xs font-medium text-slate-400 group-hover/radio:text-orange-600 transition-colors">สาย</span>
                        </label>
                    </td>
                `;
            } else {
                actionHtml = `
                    <td class="p-3 align-middle text-center">
                        <input type="number" inputmode="decimal" class="student-score w-24 mx-auto bg-slate-50 border border-slate-200 rounded-xl h-12 text-center text-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-inner" placeholder="-" data-index="${index}">
                    </td>
                `;
            }

            tr.innerHTML = `
                <td class="p-4 text-center text-slate-400 font-medium">${student.room_num || '-'}</td>
                <td class="p-4 text-slate-400 text-sm hidden md:table-cell">${student.std_id}</td>
                <td class="p-4 text-slate-700 font-medium">${student.name}</td>
                ${actionHtml}
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-rose-500 font-medium bg-rose-50">พบปัญหา: ${error.message}</td></tr>`;
    }
}

// บันทึกข้อมูล
async function saveData() {
    if (!initSupabase()) return;

    const dateStr = document.getElementById('dateSelect').value;
    const room = document.getElementById('roomSelect').value;
    const period = document.getElementById('periodSelect').value;

    updateStatus('กำลังบันทึกข้อมูล...', 'blue');

    const recordsToInsert = [];

    if (currentMode === 'attendance') {
        currentStudents.forEach((student, index) => {
            const selectedStatus = document.querySelector(`input[name="status_${index}"]:checked`);
            if (selectedStatus) {
                recordsToInsert.push({
                    record_date: dateStr,
                    room_number: room,
                    period_number: parseInt(period),
                    std_id: student.std_id,
                    student_name: student.name,
                    status: selectedStatus.value
                });
            }
        });

        if (recordsToInsert.length === 0) {
            updateStatus('กรุณาเช็คชื่ออย่างน้อย 1 คน', 'rose');
            return;
        }

        try {
            const { data, error } = await supabaseClient
                .from('m33201_1_2569_attendance_records') // ✅ เปลี่ยนเป็นชื่อใหม่
                .insert(recordsToInsert);

            if (error) throw error;
            successSave(`บันทึกเช็คชื่อสำเร็จ (${recordsToInsert.length} คน)`);
            document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);

        } catch (error) {
            handleError(error);
        }

    } else if (currentMode === 'score') {
        const type = document.getElementById('typeSelect').value;
        const topic = document.getElementById('topicInput').value;

        if (!topic.trim()) {
            updateStatus('กรุณากรอกหัวข้อเรื่อง/รายละเอียดงาน', 'rose');
            document.getElementById('topicInput').focus();
            return;
        }

        document.querySelectorAll('.student-score').forEach(scoreInput => {
            const scoreValue = scoreInput.value.trim();
            const index = scoreInput.getAttribute('data-index');
            const student = currentStudents[index];

            if (scoreValue !== "") {
                recordsToInsert.push({
                    record_date: dateStr,
                    room_number: room,
                    period_number: parseInt(period),
                    task_type: type,
                    topic: topic,
                    std_id: student.std_id,
                    student_name: student.name,
                    score: parseFloat(scoreValue)
                });
            }
        });

        if (recordsToInsert.length === 0) {
            updateStatus('กรุณากรอกคะแนนอย่างน้อย 1 คน', 'rose');
            return;
        }

        try {
            const { data, error } = await supabaseClient
                .from('students_m33201_1_2569_records')
                .insert(recordsToInsert);

            if (error) throw error;
            successSave(`บันทึกคะแนนสำเร็จ (${recordsToInsert.length} คน)`);
            document.querySelectorAll('.student-score').forEach(input => input.value = '');

        } catch (error) {
            handleError(error);
        }
    }
}

function updateStatus(message, colorClass) {
    const statusMsg = document.getElementById('statusMsg');
    const statusDot = document.getElementById('statusDot');
    
    statusMsg.textContent = message;
    
    // Reset classes
    statusMsg.className = `text-sm md:text-base font-semibold truncate text-${colorClass}-600`;
    statusDot.className = `w-2 h-2 rounded-full bg-${colorClass}-500 ${colorClass === 'blue' ? 'animate-pulse' : ''}`;
}

function successSave(message) {
    updateStatus(message, 'emerald');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // เด้งกลับไปสถานะปกติหลัง 3 วิ
    setTimeout(() => {
        updateStatus('พร้อมบันทึกข้อมูล', 'slate');
    }, 3000);
}

function handleError(error) {
    console.error('Database Error:', error);
    updateStatus(`เกิดข้อผิดพลาด: ${error.message}`, 'rose');
}
