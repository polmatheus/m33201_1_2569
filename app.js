const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentStudents = [];

async function loadStudents() {
    const room = document.getElementById('roomSelect').value;
    const period = document.getElementById('periodSelect').value;

    if (!room || !period) {
        alert("กรุณาเลือกห้องและคาบเรียนให้ครบถ้วน");
        return;
    }

    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center p-6 text-gray-500 animate-pulse">กำลังโหลดข้อมูล...</td></tr>';
    
    document.getElementById('tableContainer').style.display = 'block';
    // แสดงแถบบันทึกด้านล่าง
    document.getElementById('action-bar').classList.remove('translate-y-full');
    
    const statusMsg = document.getElementById('statusMsg');
    statusMsg.textContent = 'พร้อมกรอกคะแนน';
    statusMsg.className = 'text-sm font-semibold text-gray-500 truncate flex-1';

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
            tbody.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-red-500 font-semibold">ไม่พบรายชื่อนักเรียนห้อง ${room}</td></tr>`;
            document.getElementById('action-bar').classList.add('translate-y-full'); // ซ่อนแถบถ้าไม่มีนักเรียน
            return;
        }

        // วาดตารางแบบใหม่ เน้นช่องกรอกคะแนนขนาดใหญ่
        currentStudents.forEach((student, index) => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-blue-50 transition-colors";
            tr.innerHTML = `
                <td class="p-3 text-center text-gray-500 font-medium">${student.room_num || '-'}</td>
                <td class="p-3 text-gray-400 text-sm hidden md:table-cell">${student.std_id}</td>
                <td class="p-3 text-gray-800 font-medium">${student.name}</td>
                <td class="p-2 align-middle text-center">
                    <input type="number" inputmode="decimal" class="student-score w-full bg-gray-50 border border-gray-300 rounded-lg h-12 text-center text-lg font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner" placeholder="-" data-index="${index}">
                </td>
            `;
            tbody.appendChild(tr);
        });

  } catch (error) {
        console.error('Error:', error);
        // ให้มันแสดง Error จริงๆ ออกมาบนหน้าจอเลย จะได้รู้ว่าเกิดอะไรขึ้น
        tbody.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-red-500 font-semibold">Error: ${error.message || 'ไม่สามารถเชื่อมต่อได้'}</td></tr>`;
    }
}

async function saveData() {
    const room = document.getElementById('roomSelect').value;
    const period = document.getElementById('periodSelect').value;
    const type = document.getElementById('typeSelect').value;
    const statusMsg = document.getElementById('statusMsg');

    statusMsg.textContent = 'กำลังบันทึก...';
    statusMsg.className = 'text-sm font-bold text-blue-600 truncate flex-1';

    const rows = document.querySelectorAll('#studentTableBody tr');
    const recordsToInsert = [];

    rows.forEach((row) => {
        const scoreInput = row.querySelector('.student-score');
        if (!scoreInput) return;

        const scoreValue = scoreInput.value.trim();
        const index = scoreInput.getAttribute('data-index');
        const student = currentStudents[index];

        // บันทึกข้อมูล *เฉพาะ* คนที่ถูกกรอกคะแนนลงไปเท่านั้น (ช่องว่างข้ามไป)
        if (scoreValue !== "") {
            recordsToInsert.push({
                room_number: room,
                period_number: parseInt(period),
                task_type: type,
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

        statusMsg.textContent = `บันทึกสำเร็จ (${recordsToInsert.length} คน)!`;
        statusMsg.className = 'text-sm font-bold text-green-600 truncate flex-1';
        
        // เลื่อนหน้าจอกลับไปด้านบนสุดเพื่อพร้อมโหลดห้องต่อไป
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // ล้างช่องคะแนนเพื่อป้องกันการกดเซฟซ้ำ
        document.querySelectorAll('.student-score').forEach(input => input.value = '');

    } catch (error) {
        console.error('Error:', error);
        statusMsg.textContent = 'บันทึกไม่สำเร็จ ลองอีกครั้ง';
        statusMsg.className = 'text-sm font-bold text-red-500 truncate flex-1';
    }
}
