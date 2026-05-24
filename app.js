// app.js

// 1. Initializing Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentStudents = [];
let currentMode = 'attendance'; // 'attendance' or 'score'

// ✅ แก้ไข: รอให้ HTML โหลดเสร็จก่อน แล้วค่อยใส่วันที่ปัจจุบัน เพื่อป้องกัน Error ตัวแปรเป็น null
document.addEventListener("DOMContentLoaded", () => {
    const dateInput = document.getElementById('dateSelect');
    if (dateInput) {
        // ดึงวันที่ปัจจุบันในรูปแบบ YYYY-MM-DD
        dateInput.value = new Date().toISOString().split('T')[0];
    }
});

// ==========================================
// 2. ฟังก์ชันสลับโหมด (เช็คชื่อ vs บันทึกคะแนน)
// ==========================================
function setMode(mode) {
    currentMode = mode;
    const tabAtt = document.getElementById('tabAttendance');
    const tabScore = document.getElementById('tabScore');
    const scoreFields = document.getElementById('scoreFieldsContainer');
    const topicField = document.getElementById('topicFieldContainer');
    const btnSelectAll = document.getElementById('btnSelectAll');
    
    // รีเซ็ตตาราง
    document.getElementById('tableContainer').style.display = 'none';
    document.getElementById('action-bar').classList.add('translate-y-full');
    btnSelectAll.style.display = 'none';

    if (mode === 'attendance') {
        tabAtt.className = 'tab-active flex-1 py-3 px-4 rounded-xl font-bold transition border';
        tabScore.className = 'tab-inactive flex-1 py-3 px-4 rounded-xl font-bold transition border';
        scoreFields.classList.add('hidden');
        topicField.classList.add('hidden');
        btnSelectAll.innerHTML = '✅ มาเรียนทุกคน';
    } else {
        tabScore.className = 'tab-active flex-1 py-3 px-4 rounded-xl font-bold transition border';
        tabAtt.className = 'tab-inactive flex-1 py-3 px-4 rounded-xl font-bold transition border';
        scoreFields.classList.remove('hidden');
        topicField.classList.remove('hidden');
        btnSelectAll.innerHTML = '⚡️ กรอกคะแนนเดียวกันให้ทุกคน';
    }
}

// ==========================================
// 3. ฟังก์ชันการทำงานของปุ่ม "เลือกทั้งหมด"
// ==========================================
function actionSelectAll() {
    if (currentMode === 'attendance') {
        // เช็ควิทยุ 'present' ให้ทุกคน
        document.querySelectorAll('.radio-present').forEach(radio => {
            radio.checked = true;
        });
    } else {
        // กรอกคะแนนให้ทุกคน
        const score = prompt("กรุณากรอกคะแนนที่ต้องการให้ทุกคน:");
        if (score !== null && score.trim() !== "") {
            document.querySelectorAll('.student-score').forEach(input => {
                input.value = score;
            });
        }
    }
}

// ==========================================
// 4. ฟังก์ชันโหลดรายชื่อ และสร้างตาราง
// ==========================================
async function loadStudents() {
    const room = document.getElementById('roomSelect').value;
    const period = document.getElementById('periodSelect').value;
    const date = document.getElementById('dateSelect').value;

    if (!room || !period || !date) {
        alert("กรุณาเลือกวันที่ ห้อง และคาบเรียนให้ครบถ้วน");
        return;
    }

    const tbody = document.getElementById('studentTableBody');
    const thead = document.getElementById('tableHeader');
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center p-6 text-gray-500 animate-pulse">กำลังโหลดข้อมูล...</td></tr>';
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
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-red-500 font-semibold">ไม่พบรายชื่อนักเรียนห้อง ${room}</td></tr>`;
            document.getElementById('action-bar').classList.add('translate-y-full');
            document.getElementById('btnSelectAll').style.display = 'none';
            return;
        }

        // โชว์ปุ่ม Action Bar
        document.getElementById('action-bar').classList.remove('translate-y-full');
        document.getElementById('btnSelectAll').style.display = 'block';
        document.getElementById('statusMsg').textContent = 'พร้อมบันทึกข้อมูล';
        document.getElementById('statusMsg').className = 'text-sm font-semibold text-gray-500 truncate flex-1';

        if (currentMode === 'attendance') {
            thead.innerHTML = `
                <tr>
                    <th class="p-3 font-semibold text-center w-12">ที่</th>
                    <th class="p-3 font-semibold w-20 hidden md:table-cell">รหัส</th>
                    <th class="p-3 font-semibold">ชื่อ - นามสกุล</th>
                    <th class="p-3 font-semibold text-center min-w-[200px]">สถานะการเข้าเรียน</th>
                </tr>
            `;
        } else {
            thead.innerHTML = `
                <tr>
                    <th class="p-3 font-semibold text-center w-12">ที่</th>
                    <th class="p-3 font-semibold w-20 hidden md:table-cell">รหัส</th>
                    <th class="p-3 font-semibold">ชื่อ - นามสกุล</th>
                    <th class="p-3 font-semibold text-center w-32">คะแนน</th>
                </tr>
            `;
        }

        currentStudents.forEach((student, index) => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-blue-50 transition-colors";
            
            let actionHtml = '';
            if (currentMode === 'attendance') {
                actionHtml = `
                    <td class="p-2 align-middle text-center flex justify-center gap-2 sm:gap-4">
                        <label class="cursor-pointer text-green-600 flex flex-col items-center">
                            <input type="radio" name="status_${index}" value="มา" class="radio-present w-5 h-5 mb-1 cursor-pointer accent-green-600"> มา
                        </label>
                        <label class="cursor-pointer text-red-500 flex flex-col items-center">
                            <input type="radio" name="status_${index}" value="ขาด" class="w-5 h-5 mb-1 cursor-pointer accent-red-500"> ขาด
                        </label>
                        <label class="cursor-pointer text-orange-500 flex flex-col items-center">
                            <input type="radio" name="status_${index}" value="ลา" class="w-5 h-5 mb-1 cursor-pointer accent-orange-500"> ลา
                        </label>
                        <label class="cursor-pointer text-yellow-600 flex flex-col items-center">
                            <input type="radio" name="status_${index}" value="สาย" class="w-5 h-5 mb-1 cursor-pointer accent-yellow-600"> สาย
                        </label>
                    </td>
                `;
            } else {
                actionHtml = `
                    <td class="p-2 align-middle text-center">
                        <input type="number" inputmode="decimal" class="student-score w-24 mx-auto bg-gray-50 border border-gray-300 rounded-lg h-10 text-center text-lg font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner" placeholder="-" data-index="${index}">
                    </td>
                `;
            }

            tr.innerHTML = `
                <td class="p-3 text-center text-gray-500 font-medium">${student.room_num || '-'}</td>
                <td class="p-3 text-gray-400 text-sm hidden md:table-cell">${student.std_id}</td>
                <td class="p-3 text-gray-800 font-medium">${student.name}</td>
                ${actionHtml}
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-red-500 font-semibold">Error: ${error.message}</td></tr>`;
    }
}

// ==========================================
// 5. ฟังก์ชันบันทึกข้อมูล
// ==========================================
async function saveData() {
    const dateStr = document.getElementById('dateSelect').value;
    const room = document.getElementById('roomSelect').value;
    const period = document.getElementById('periodSelect').value;
    const statusMsg = document.getElementById('statusMsg');

    statusMsg.textContent = 'กำลังบันทึกข้อมูล...';
    statusMsg.className = 'text-sm font-bold text-blue-600 truncate flex-1';

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
            statusMsg.textContent = 'กรุณาเช็คชื่ออย่างน้อย 1 คน';
            statusMsg.className = 'text-sm font-bold text-red-500 truncate flex-1';
            return;
        }

        try {
            const { data, error } = await supabaseClient
                .from('attendance_records') 
                .insert(recordsToInsert);

            if (error) throw error;
            successSave(`บันทึกเช็คชื่อสำเร็จ (${recordsToInsert.length} คน)`);
            document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);

        } catch (error) {
            handleError(error, statusMsg);
        }

    } else if (currentMode === 'score') {
        const type = document.getElementById('typeSelect').value;
        const topic = document.getElementById('topicInput').value;

        if (!topic.trim()) {
            statusMsg.textContent = 'กรุณากรอกหัวข้อเรื่อง/รายละเอียดงาน';
            statusMsg.className = 'text-sm font-bold text-red-500 truncate flex-1';
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
            statusMsg.textContent = 'กรุณากรอกคะแนนอย่างน้อย 1 คน';
            statusMsg.className = 'text-sm font-bold text-red-500 truncate flex-1';
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
            handleError(error, statusMsg);
        }
    }
}

function successSave(message) {
    const statusMsg = document.getElementById('statusMsg');
    statusMsg.textContent = message;
    statusMsg.className = 'text-sm font-bold text-green-600 truncate flex-1';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleError(error, statusElement) {
    console.error('Database Error:', error);
    statusElement.textContent = `เกิดข้อผิดพลาด: ${error.message}`;
    statusElement.className = 'text-sm font-bold text-red-500 truncate flex-1';
}
