const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentStudents = [];

// ฟังก์ชันโหลดรายชื่อ
async function loadStudents() {
    const room = document.getElementById('roomSelect').value;
    const period = document.getElementById('periodSelect').value;

    if (!room || !period) {
        alert("กรุณาเลือกห้องและคาบเรียนให้ครบถ้วน");
        return;
    }

    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-500">กำลังโหลดข้อมูล...</td></tr>';
    document.getElementById('tableContainer').style.display = 'block';
    document.getElementById('statusMsg').textContent = '';

    try {
        // อัปเดต: เรียงลำดับด้วย room_num แทน no
        const { data, error } = await supabaseClient
            .from('students_m33201_1_2569')
            .select('*')
            .eq('room', room)
            .order('room_num', { ascending: true });

        if (error) throw error;

        currentStudents = data;
        tbody.innerHTML = '';

        if (currentStudents.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-red-500">ไม่พบรายชื่อนักเรียนห้อง ${room} ในระบบ</td></tr>`;
            return;
        }

        // สร้างตาราง
        currentStudents.forEach((student, index) => {
            const tr = document.createElement('tr');
            tr.className = "border-b hover:bg-gray-50 transition";
            tr.innerHTML = `
                <td class="p-3 text-center text-gray-600">${student.room_num || '-'}</td>
                <td class="p-3 text-center text-blue-600 font-medium">${student.std_id}</td>
                <td class="p-3 text-gray-800">${student.name}</td>
                <td class="p-3 text-center">
                    <input type="checkbox" class="student-checkbox w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" data-index="${index}">
                </td>
                <td class="p-3 text-center">
                    <input type="number" min="0" class="student-score w-full border border-gray-300 rounded p-1 text-center outline-none focus:border-blue-500" placeholder="0" data-index="${index}">
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('checkAllBtn').checked = false;

    } catch (error) {
        console.error('Error:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-red-500">เกิดข้อผิดพลาดในการดึงข้อมูล</td></tr>';
    }
}

// ฟังก์ชันเลือกทั้งหมด
function toggleCheckAll() {
    const isChecked = document.getElementById('checkAllBtn').checked;
    const checkboxes = document.querySelectorAll('.student-checkbox');
    checkboxes.forEach(cb => cb.checked = isChecked);
}

// ฟังก์ชันบันทึกข้อมูล
async function saveData() {
    const room = document.getElementById('roomSelect').value;
    const period = document.getElementById('periodSelect').value;
    const type = document.getElementById('typeSelect').value;
    const statusMsg = document.getElementById('statusMsg');

    statusMsg.textContent = 'กำลังบันทึกข้อมูล...';
    statusMsg.className = 'text-sm font-medium text-blue-600';

    const rows = document.querySelectorAll('#studentTableBody tr');
    const recordsToInsert = [];

    rows.forEach((row) => {
        const checkbox = row.querySelector('.student-checkbox');
        const scoreInput = row.querySelector('.student-score');
        
        if (!checkbox || !scoreInput) return;

        const index = checkbox.getAttribute('data-index');
        const student = currentStudents[index];
        const isSubmitted = checkbox.checked;
        const scoreValue = scoreInput.value;
        const score = scoreValue ? parseFloat(scoreValue) : 0;

        if (isSubmitted || score > 0) {
            recordsToInsert.push({
                room_number: room,
                period_number: parseInt(period),
                task_type: type,
                std_id: student.std_id,
                student_name: student.name,
                is_submitted: isSubmitted,
                score: score
            });
        }
    });

    if (recordsToInsert.length === 0) {
        statusMsg.textContent = 'ไม่มีข้อมูลที่ต้องบันทึก';
        statusMsg.className = 'text-sm font-medium text-red-500';
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('students_m33201_1_2569_records')
            .insert(recordsToInsert);

        if (error) throw error;

        statusMsg.textContent = 'บันทึกข้อมูลสำเร็จ!';
        statusMsg.className = 'text-sm font-medium text-green-600';
        
    } catch (error) {
        console.error('Error:', error);
        statusMsg.textContent = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
        statusMsg.className = 'text-sm font-medium text-red-500';
    }
}
