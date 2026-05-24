// dashboard.js

let supabaseClient = null;

function initSupabase() {
    try {
        if (!supabaseClient) {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }
        return true;
    } catch (error) {
        alert("❌ โหลด Supabase ไม่สำเร็จ: " + error.message);
        return false;
    }
}

// โหลดข้อมูลอัตโนมัติเมื่อเปิดหน้าเว็บ
document.addEventListener("DOMContentLoaded", () => {
    loadDashboard();
});

async function loadDashboard() {
    if (!initSupabase()) return;

    const room = document.getElementById('roomSelect').value;
    const loadingState = document.getElementById('loadingState');
    const dashboardContent = document.getElementById('dashboardContent');
    const tbody = document.getElementById('summaryTableBody');

    // UI States
    loadingState.classList.remove('hidden');
    dashboardContent.classList.add('hidden');
    tbody.innerHTML = '';

    try {
        // 1. ดึงข้อมูลรายชื่อนักเรียน
        let studentsQuery = supabaseClient.from('students_m33201_1_2569').select('*');
        if (room !== 'all') {
            studentsQuery = studentsQuery.eq('room', room);
        }
        studentsQuery = studentsQuery.order('room', { ascending: true }).order('room_num', { ascending: true });
        
        const { data: studentsData, error: err1 } = await studentsQuery;
        if (err1) throw err1;

        // 2. ดึงข้อมูลการเข้าเรียน
        let attQuery = supabaseClient.from('m33201_1_2569_attendance_records').select('*');
        if (room !== 'all') attQuery = attQuery.eq('room_number', room);
        const { data: attData, error: err2 } = await attQuery;
        if (err2) throw err2;

        // 3. ดึงข้อมูลคะแนน
        let scoreQuery = supabaseClient.from('students_m33201_1_2569_records').select('*');
        if (room !== 'all') scoreQuery = scoreQuery.eq('room_number', room);
        const { data: scoreData, error: err3 } = await scoreQuery;
        if (err3) throw err3;

        // ==========================================
        // ประมวลผลข้อมูล (Data Processing)
        // ==========================================
        
        // สร้าง Map เก็บข้อมูลนักเรียนรายบุคคล
        const studentStats = {};
        studentsData.forEach(s => {
            studentStats[s.std_id] = {
                ...s,
                present: 0,
                absent: 0,
                leave: 0,
                late: 0,
                totalScore: 0
            };
        });

        // นับสถิติการเข้าเรียน
        let totalAttendanceRecords = 0;
        let totalPresent = 0;
        let totalAbsent = 0;

        attData.forEach(record => {
            if (studentStats[record.std_id]) {
                totalAttendanceRecords++;
                if (record.status === 'มา') {
                    studentStats[record.std_id].present++;
                    totalPresent++;
                } else if (record.status === 'ขาด') {
                    studentStats[record.std_id].absent++;
                    totalAbsent++;
                } else if (record.status === 'ลา') {
                    studentStats[record.std_id].leave++;
                } else if (record.status === 'สาย') {
                    studentStats[record.std_id].late++;
                }
            }
        });

        // รวมสถิติคะแนน
        let sumAllScores = 0;
        scoreData.forEach(record => {
            if (studentStats[record.std_id]) {
                const s = parseFloat(record.score) || 0;
                studentStats[record.std_id].totalScore += s;
                sumAllScores += s;
            }
        });

        // ==========================================
        // อัปเดต Summary Cards
        // ==========================================
        const totalStudents = studentsData.length;
        document.getElementById('totalStudents').innerText = totalStudents;
        document.getElementById('totalAbsence').innerText = totalAbsent;
        
        // คำนวณอัตรามาเรียน (มา / (มา+ขาด+ลา+สาย))
        if (totalAttendanceRecords > 0) {
            const rate = ((totalPresent / totalAttendanceRecords) * 100).toFixed(1);
            document.getElementById('attendanceRate').innerText = `${rate}%`;
        } else {
            document.getElementById('attendanceRate').innerText = `0%`;
        }

        // คำนวณคะแนนเฉลี่ย
        if (totalStudents > 0) {
            const avg = (sumAllScores / totalStudents).toFixed(1);
            document.getElementById('avgScore').innerText = avg;
        } else {
            document.getElementById('avgScore').innerText = `0`;
        }

        // อัปเดต Subtitle ตาราง
        document.getElementById('tableSubtitle').innerText = room === 'all' ? 'รวมนักเรียนทั้งหมด' : `เฉพาะนักเรียนห้อง ${room}`;

        // ==========================================
        // สร้างตารางรายบุคคล
        // ==========================================
        if (totalStudents === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-slate-500">ไม่พบข้อมูลนักเรียน</td></tr>`;
        } else {
            studentsData.forEach(student => {
                const stat = studentStats[student.std_id];
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 transition-colors";
                tr.innerHTML = `
                    <td class="p-4 text-center font-bold text-slate-500">${stat.room}</td>
                    <td class="p-4 text-slate-400 text-sm hidden md:table-cell">${stat.std_id}</td>
                    <td class="p-4 text-slate-700 font-medium">${stat.name}</td>
                    <td class="p-4 text-center font-semibold text-emerald-600 bg-emerald-50/20">${stat.present}</td>
                    <td class="p-4 text-center font-semibold ${stat.absent > 0 ? 'text-rose-600' : 'text-slate-300'} bg-rose-50/20">${stat.absent}</td>
                    <td class="p-4 text-center font-semibold ${stat.leave > 0 ? 'text-amber-600' : 'text-slate-300'} bg-amber-50/20">${stat.leave}</td>
                    <td class="p-4 text-center font-semibold ${stat.late > 0 ? 'text-orange-600' : 'text-slate-300'} bg-orange-50/20">${stat.late}</td>
                    <td class="p-4 text-center font-bold text-blue-600 bg-blue-50/20">${stat.totalScore.toFixed(1)}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // แสดงผล
        loadingState.classList.add('hidden');
        dashboardContent.classList.remove('hidden');

    } catch (error) {
        console.error('Error loading dashboard:', error);
        loadingState.innerHTML = `<span class="text-rose-500">❌ เกิดข้อผิดพลาด: ${error.message}</span>`;
    }
}
