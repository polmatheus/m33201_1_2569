// app.js

let supabaseClient = null;
let currentStudents = [];
let currentMode = 'attendance';

// ==========================================
// ตั้งค่าระบบและการแสดงผลเบื้องต้น
// ==========================================
function initSupabase() {
    try {
        if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_KEY === 'undefined') {
            alert("❌ ไม่พบไฟล์ config.js หรือยังไม่ได้ตั้งค่าตัวแปร");
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
            // ตั้งค่าวางวันที่ปัจจุบันให้อัตโนมัติเมื่อเปิดหน้าเว็บ
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    } catch(e) {
        console.error("Date setting error:", e);
    }
});

// สลับโหมดการทำงาน (เช็คชื่อ <-> บันทึกคะแนน)
function setMode(mode) {
    currentMode = mode;
    const tabAtt = document.getElementById('tabAttendance');
    const tabScore = document.getElementById('tabScore');
    const scoreFields = document.getElementById('scoreFieldsContainer');
    const topicField = document.getElementById('topicFieldContainer');
    const btnSelectAll = document.getElementById('btnSelectAll');
    
    // ซ่อนตารางไว้ก่อนจนกว่าจะกดโหลดใหม่
    if (document.getElementById('tableContainer')) document.getElementById('tableContainer').style.display = 'none';
    if (document.getElementById('action-bar')) document.getElementById('action-bar').classList.add('translate-y-full');
    if (btnSelectAll) btnSelectAll.style.display = 'none';

    if (mode === 'attendance') {
        if (tabAtt) tabAtt.className = 'tab-active flex-1 py-3 text-sm md:text-base transition-all duration-200';
        if (tabScore) tabScore.className = 'tab-inactive flex-1 py-3 text-sm md:text-base transition-all duration-200 hover:text-slate-700';
        if (scoreFields) scoreFields.classList.add('hidden');
        if (topicField) topicField.classList.add('hidden');
        if (btnSelectAll) {
            btnSelectAll.innerHTML = '✅ มาเรียนทุกคน';
            btnSelectAll.className = 'flex-1 bg-white text-slate-700 h-14 rounded-2xl font-semibold hover:bg-slate-50 active:bg-slate-100 transition-all border border-slate-200 shadow-sm text-base';
        }
    } else {
        if (tabScore) tabScore.className = 'tab-active flex-1 py-3 text-sm md:text-base transition-all duration-200';
        if (tabAtt) tabAtt.className = 'tab-inactive flex-1 py-3 text-sm md:text-base transition-all duration-200 hover:text-slate-700';
        if (scoreFields) scoreFields.classList.remove('hidden');
        if (topicField) topicField.classList.remove('hidden');
        if (btnSelectAll) {
            btnSelectAll.innerHTML = '⚡️ กรอกคะแนนเดียวกันทุกคน';
            btnSelectAll.className = 'flex-1 bg-indigo-50 text-indigo-700 h-14 rounded-2xl font-semibold hover:bg-indigo-100 active:bg-indigo-200 transition-all border border-indigo-200 text-base';
        }
    }
}

// ปุ่มทางลัด (มาทุกคน / ให้คะแนนเท่ากันทุกคน)
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

// ==========================================
// 1. ฟังก์ชันโหลดรายชื่อ และดึงข้อมูลเดิมมาแก้ไข (Smart Load)
// ==========================================
async function loadStudents() {
    if (!initSupabase()) return;

    const roomEl = document.getElementById('roomSelect');
    const periodEl = document.getElementById('periodSelect');
    const dateEl = document.getElementById('dateSelect');

    if (!roomEl || !periodEl || !dateEl) {
        alert("⚠️ โครงสร้าง HTML ไม่สมบูรณ์ ไม่พบตัวเลือกห้อง คาบ หรือวันที่");
        return;
    }

    const room = roomEl.value;
    const period = periodEl.value;
    const date = dateEl.value;

    if (!room || !period || !date) {
        alert("⚠️ กรุณาเลือก วันที่, ห้องเรียน และ คาบเรียน ให้ครบถ้วน");
        return;
    }

    let taskType = '';
    let topic = '';
    // ตรวจสอบข้อมูลเฉพาะตอนอยู่โหมดให้คะแนน
    if (currentMode === 'score') {
        const taskTypeEl = document.getElementById('taskType');
        const topicInputEl = document.getElementById('topicInput');
        
        if (!taskTypeEl || !topicInputEl) {
            alert("⚠️ ไม่พบฟิลด์กรอกข้อมูลคะแนนในหน้าเว็บ");
            return;
        }
        
        taskType = taskTypeEl.value;
        topic = topicInputEl.value.trim();
        
        if (!topic) {
            alert("⚠️ กรุณาระบุชื่อชิ้นงาน/หัวข้อคะแนน");
            return;
        }
    }

    const tbody = document.getElementById('studentTableBody');
    const thead = document.getElementById('tableHeader');
    if (!tbody || !thead) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center p-8 text-slate-500 font-medium animate-pulse">กำลังโหลดข้อมูลและตรวจสอบประวัติ...</td></tr>';
    if (document.getElementById('tableContainer')) document.getElementById('tableContainer').style.display = 'block';
    
    try {
        // [1] ดึงรายชื่อนักเรียนจากฐานข้อมูลหลัก
        const { data: studentsData, error: studentsError } = await supabaseClient
            .from('students_m33201_1_2569') 
            .select('*')
            .eq('room', room)
            .order('room_num', { ascending: true });
            
        if (studentsError) throw studentsError;

        // [2] ดึงประวัติการลาของห้องนี้ ในวันนี้
        const { data: leavesData } = await supabaseClient
            .from('m33201_1_2569_student_leaves')
            .select('std_id, leave_type')
            .eq('leave_date', date)
            .eq('room_number', room);

        const leaveMap = {};
        if (leavesData) leavesData.forEach(leave => leaveMap[leave.std_id] = leave.leave_type);

        // [3] ดึงข้อมูลการบันทึกเดิม (ถ้าเคยเช็คชื่อหรือให้คะแนนหัวข้อนี้ไปแล้ว)
        let existingDataMap = {};
        let isEditing = false;

        if (currentMode === 'attendance') {
            const { data: existingAtt } = await supabaseClient
                .from('m33201_1_2569_attendance_records')
                .select('*')
                .eq('record_date', date)
                .eq('room_number', room)
                .eq('period_number', period);
            
            if (existingAtt && existingAtt.length > 0) {
                isEditing = true;
                existingAtt.forEach(r => existingDataMap[r.std_id] = r);
            }
        } else {
            const { data: existingScore } = await supabaseClient
                .from('students_m33201_1_2569_records')
                .select('*')
                .eq('record_date', date)
                .eq('room_number', room)
                .eq('period_number', period)
                .eq('task_type', taskType)
                .eq('topic', topic);
            
            if (existingScore && existingScore.length > 0) {
                isEditing = true;
                existingScore.forEach(r => existingDataMap[r.std_id] = r);
            }
        }

        currentStudents = studentsData;
        tbody.innerHTML = '';

        // ถ้าไม่มีนักเรียนในห้องที่เลือก
        if (currentStudents.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-red-500 font-medium bg-red-50">ไม่พบรายชื่อนักเรียนห้อง ${room}</td></tr>`;
            if (document.getElementById('action-bar')) document.getElementById('action-bar').classList.add('translate-y-full');
            if (document.getElementById('btnSelectAll')) document.getElementById('btnSelectAll').style.display = 'none';
            return;
        }

        if (document.getElementById('action-bar')) document.getElementById('action-bar').classList.remove('translate-y-full');
        if (document.getElementById('btnSelectAll')) document.getElementById('btnSelectAll').style.display = 'block';
        
        // แจ้งเตือนครูว่าเข้าสู่โหมดแก้ไขหรือเริ่มใหม่
        if (isEditing) {
            updateStatus('✏️ พบข้อมูลเดิม (เข้าสู่โหมดแก้ไข)', 'amber');
        } else {
            updateStatus('พร้อมบันทึกข้อมูลใหม่', 'slate');
        }

        // จัดการ Header ตาราง
        if (currentMode === 'attendance') {
            thead.innerHTML = `<tr><th class="p-4 font-semibold text-center w-12 rounded-tl-2xl">ที่</th><th class="p-4 font-semibold w-20 hidden md:table-cell">รหัส</th><th class="p-4 font-semibold">ชื่อ - นามสกุล</th><th class="p-4 font-semibold text-center min-w-[240px] rounded-tr-2xl">สถานะการเข้าเรียน</th></tr>`;
        } else {
            thead.innerHTML = `<tr><th class="p-4 font-semibold text-center w-12 rounded-tl-2xl">ที่</th><th class="p-4 font-semibold w-20 hidden md:table-cell">รหัส</th><th class="p-4 font-semibold">ชื่อ - นามสกุล</th><th class="p-4 font-semibold text-center w-32 rounded-tr-2xl">คะแนน</th></tr>`;
        }

        // สร้างรายการนักเรียนทีละบรรทัด
        currentStudents.forEach((student, index) => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition-colors duration-150 group";
            
            // ⭐️ หัวใจสำคัญ: ฝัง ID เดิมไว้ในแต่ละบรรทัด เพื่อให้ระบบรู้ว่าต้องอัปเดตบรรทัดไหน
            const existingRecord = existingDataMap[student.std_id];
            if (existingRecord) {
                tr.setAttribute('data-record-id', existingRecord.id);
            }
            
            const hasLeave = leaveMap[student.std_id] ? true : false;
            const leaveTypeInfo = leaveMap[student.std_id] || '';
            let actionHtml = '';

            if (currentMode === 'attendance') {
                // เงื่อนไข: ถ้าเคยบันทึก ให้เอาค่าเดิมมาแสดง, ถ้าไม่เคยบันทึก ให้เช็คว่าลาหรือไม่
                let selectedStatus = existingRecord ? existingRecord.status : (hasLeave ? 'ลา' : '');
                
                const statuses = [
                    { val: 'มา', color: 'emerald' },
                    { val: 'ขาด', color: 'rose' },
                    { val: 'ลา', color: 'amber' },
                    { val: 'สาย', color: 'orange' }
                ];

                let radios = statuses.map(s => `
                    <label class="cursor-pointer flex flex-col items-center group/radio">
                        <input type="radio" name="status_${index}" value="${s.val}" class="w-6 h-6 mb-1 cursor-pointer accent-${s.color}-500 ${s.val === 'มา' ? 'radio-present' : ''}" ${selectedStatus === s.val ? 'checked' : ''}>
                        <span class="text-xs font-medium text-slate-400 group-hover/radio:text-${s.color}-600 transition-colors">${s.val}</span>
                    </label>
                `).join('');

                actionHtml = `
                    <td class="p-3 align-middle text-center">
                        <div class="flex justify-center gap-4 md:gap-6">${radios}</div>
                        ${hasLeave ? `<div class="text-[11px] font-semibold text-amber-600 mt-1.5 bg-amber-50 inline-block px-2 py-0.5 rounded-full border border-amber-200">มีรายการ: ${leaveTypeInfo}</div>` : ''}
                    </td>
                `;
            } else {
                let scoreVal = existingRecord ? existingRecord.score : '';
                actionHtml = `
                    <td class="p-3 align-middle text-center">
                        <input type="number" inputmode="decimal" class="student-score w-24 mx-auto bg-slate-50 border border-slate-200 rounded-xl h-12 text-center text-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-inner" value="${scoreVal}" placeholder="-" data-index="${index}">
                        ${hasLeave ? `<div class="text-[11px] font-semibold text-amber-600 mt-1">มีรายการ: ${leaveTypeInfo}</div>` : ''}
                    </td>
                `;
            }

            tr.innerHTML = `<td class="p-4 text-center text-slate-400 font-medium">${student.room_num || '-'}</td><td class="p-4 text-slate-400 text-sm hidden md:table-cell">${student.std_id}</td><td class="p-4 text-slate-700 font-medium">${student.name}</td>${actionHtml}`;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-rose-500 font-medium bg-rose-50">พบปัญหา: ${error.message}</td></tr>`;
    }
}

// ==========================================
// 2. ฟังก์ชันบันทึกข้อมูล (ใช้ Upsert เพื่อให้บันทึกทับของเดิมได้)
// ==========================================
async function saveData() {
    if (!initSupabase()) return;

    const room = document.getElementById('roomSelect').value;
    const period = document.getElementById('periodSelect').value;
    const date = document.getElementById('dateSelect').value;
    
    if (!room || !period || !date) {
        alert("กรุณาเลือกข้อมูลให้ครบถ้วนก่อนบันทึก");
        return;
    }

    let taskType = '';
    let topic = '';
    if (currentMode === 'score') {
        taskType = document.getElementById('taskType').value;
        topic = document.getElementById('topicInput').value.trim();
        if (!topic) {
            alert("กรุณาระบุหัวข้อ/ชิ้นงานก่อนบันทึก");
            return;
        }
    }

    const payload = [];
    const tbody = document.getElementById('studentTableBody');
    if (!tbody) return;
    let hasMissingData = false;

    // ดึงข้อมูลจากตารางที่แสดงผลอยู่
    for (let i = 0; i < currentStudents.length; i++) {
        const tr = tbody.children[i];
        if (!tr) continue;
        const student = currentStudents[i];
        const recordId = tr.getAttribute('data-record-id'); // ไอดีของแถวข้อมูลเดิม (ถ้ามี)

        if (currentMode === 'attendance') {
            const checkedRadio = document.querySelector(`input[name="status_${i}"]:checked`);
            if (!checkedRadio) {
                hasMissingData = true;
                continue; // ข้ามคนที่ยังไม่ได้เช็คชื่อ
            }
            
            let obj = {
                record_date: date,
                room_number: room,
                period_number: parseInt(period),
                std_id: student.std_id,
                student_name: student.name,
                status: checkedRadio.value
            };
            if (recordId) obj.id = parseInt(recordId); // ใส่ ID กลับเข้าไปเพื่อให้มัน Update
            payload.push(obj);

        } else {
            const scoreInputEl = document.querySelector(`.student-score[data-index="${i}"]`);
            if (scoreInputEl && scoreInputEl.value !== '') {
                let obj = {
                    record_date: date,
                    room_number: room,
                    period_number: parseInt(period),
                    task_type: taskType,
                    topic: topic,
                    std_id: student.std_id,
                    student_name: student.name,
                    score: parseFloat(scoreInputEl.value)
                };
                if (recordId) obj.id = parseInt(recordId); // ใส่ ID กลับเข้าไปเพื่อให้มัน Update
                payload.push(obj);
            }
        }
    }

    if (currentMode === 'attendance' && hasMissingData) {
        if (!confirm("⚠️ มีนักเรียนบางคนที่คุณยังไม่ได้เลือกสถานะเช็คชื่อ\nคุณต้องการบันทึกเฉพาะคนที่เลือกสถานะไว้แล้วใช่หรือไม่?")) {
            return;
        }
    }

    if (payload.length === 0) {
        alert("ไม่มีข้อมูลให้บันทึก (คุณยังไม่ได้กรอกคะแนน หรือไม่ได้เช็คชื่อเลย)");
        return;
    }

    updateStatus('⏳ กำลังบันทึกข้อมูล...', 'slate');

    try {
        const tableName = currentMode === 'attendance' ? 'm33201_1_2569_attendance_records' : 'students_m33201_1_2569_records';
        
        // ⭐️ ใช้ upsert (Update or Insert) แทนคำสั่ง insert ธรรมดา
        const { error } = await supabaseClient.from(tableName).upsert(payload);

        if (error) throw error;

        updateStatus('✅ บันทึก/อัปเดตข้อมูลเรียบร้อยแล้ว!', 'emerald');
        setTimeout(() => {
            updateStatus('พร้อมทำงาน', 'slate');
            loadStudents(); // โหลดข้อมูลอีกครั้งเพื่ออัปเดตแถบสีและการแสดงผล
        }, 2000);

    } catch (error) {
        console.error('Error saving:', error);
        updateStatus('❌ เกิดข้อผิดพลาดในการบันทึก', 'rose');
        alert("บันทึกไม่สำเร็จ: " + error.message);
    }
}

// ฟังก์ชันตกแต่งข้อความแจ้งเตือนด้านล่าง
function updateStatus(message, colorClass) {
    const statusMsg = document.getElementById('statusMsg');
    const statusDot = document.getElementById('statusDot');
    
    if (statusMsg) {
        statusMsg.textContent = message;
        statusMsg.className = `text-sm md:text-base font-semibold truncate text-${colorClass}-600`;
    }
    if (statusDot) {
        statusDot.className = `w-2 h-2 rounded-full bg-${colorClass}-500 ${colorClass === 'blue' ? 'animate-pulse' : ''}`;
    }
}
