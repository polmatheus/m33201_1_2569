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

document.addEventListener("DOMContentLoaded", () => {
    loadDashboard();
});

async function loadDashboard() {
    if (!initSupabase()) return;

    const room = document.getElementById('roomSelect').value;
    const loadingState = document.getElementById('loadingState');
    const dashboardContent = document.getElementById('dashboardContent');
    const tbody = document.getElementById('summaryTableBody');
    const btnExcel = document.getElementById('btnExcel');

    loadingState.classList.remove('hidden');
    dashboardContent.classList.add('hidden');
    btnExcel.classList.add('hidden'); // ซ่อนปุ่ม Excel ไว้ก่อนจนกว่าจะโหลดเสร็จ
    tbody.innerHTML = '';

    try {
        // 1. ดึงข้อมูลนักเรียนทั้งหมด (ให้ฐานข้อมูลเรียงให้ระดับนึงก่อน)
        let studentsQuery = supabaseClient.from('students_m33201_1_2569').select('*');
        if (room !== 'all') studentsQuery = studentsQuery.eq('room', room);
        const { data: rawStudents, error: err1 } = await studentsQuery;
        if (err1) throw err1;

        // จัดเรียงแบบชัวร์ 100% ด้วย JavaScript (ห้องน้อยไปมาก -> เลขที่น้อยไปมาก)
        const studentsData = rawStudents.sort((a, b) => {
            const roomA = parseInt(a.room) || 0;
            const roomB = parseInt(b.room) || 0;
            if (roomA !== roomB) return roomA - roomB;
            
            const numA = parseInt(a.room_num) || 999;
            const numB = parseInt(b.room_num) || 999;
            return numA - numB;
        });

        // 2. ดึงข้อมูลการเช็คชื่อ
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
        
        const studentStats = {};
        studentsData.forEach(s => {
            studentStats[s.std_id] = {
                ...s,
                present: 0, absent: 0, leave: 0, late: 0,
                hw: 0, quiz: 0, bonus: 0, totalScore: 0
            };
        });

        // ตัวแปรนับจำนวนครั้งที่เช็คชื่อ (นับจาก วันที่ + คาบ + ห้อง ที่ไม่ซ้ำกัน)
        const uniqueCheckSessions = new Set();
        let totalAttendanceRecords = 0;
        let totalPresent = 0;
        let totalAbsent = 0;

        attData.forEach(record => {
            // สร้าง Key เพื่อเช็คว่าคาบนี้เคยนับหรือยัง เช่น "2026-05-25_คาบ1_ห้อง3"
            uniqueCheckSessions.add(`${record.record_date}_${record.period_number}_${record.room_number}`);

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

        let sumAllScores = 0;
        scoreData.forEach(record => {
            if (studentStats[record.std_id]) {
                const s = parseFloat(record.score) || 0;
                studentStats[record.std_id].totalScore += s;
                sumAllScores += s;

                // แยกคะแนนตามประเภท
                if (record.task_type === 'Homework') {
                    studentStats[record.std_id].hw += s;
                } else if (record.task_type === 'Quiz') {
                    studentStats[record.std_id].quiz += s;
                } else if (record.task_type === 'Bonus') {
                    studentStats[record.std_id].bonus += s;
                }
            }
        });

        // ==========================================
        // อัปเดตการ์ดสรุปผล
        // ==========================================
        const totalStudents = studentsData.length;
        document.getElementById('totalStudents').innerText = totalStudents;
        document.getElementById('totalChecks').innerText = uniqueCheckSessions.size; // อัปเดตจำนวนครั้ง
        document.getElementById('totalAbsence').innerText = totalAbsent;
        
        if (totalAttendanceRecords > 0) {
            const rate = ((totalPresent / totalAttendanceRecords) * 100).toFixed(1);
            document.getElementById('attendanceRate').innerText = `${rate}%`;
        } else {
            document.getElementById('attendanceRate').innerText = `0%`;
        }

        if (totalStudents > 0) {
            const avg = (sumAllScores / totalStudents).toFixed(1);
            document.getElementById('avgScore').innerText = avg;
        } else {
            document.getElementById('avgScore').innerText = `0`;
        }

        document.getElementById('tableSubtitle').innerText = room === 'all' ? 'รวมนักเรียนทั้งหมดเรียงตามห้องและเลขที่' : `เฉพาะนักเรียนห้อง ${room}`;

        // ==========================================
        // สร้างตารางรายบุคคล
        // ==========================================
        if (totalStudents === 0) {
            tbody.innerHTML = `<tr><td colspan="12" class="text-center p-8 text-slate-500">ไม่พบข้อมูลนักเรียน</td></tr>`;
        } else {
            studentsData.forEach(student => {
                const stat = studentStats[student.std_id];
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 transition-colors";
                tr.innerHTML = `
                    <td class="p-3 text-center font-bold text-slate-500">${stat.room}</td>
                    <td class="p-3 text-center font-bold text-slate-700">${stat.room_num || '-'}</td>
                    <td class="p-3 text-slate-400 text-xs hidden md:table-cell">${stat.std_id}</td>
                    <td class="p-3 text-slate-700 font-medium">${stat.name}</td>
                    
                    <td class="p-3 text-center font-semibold text-emerald-600 bg-emerald-50/40">${stat.present}</td>
                    <td class="p-3 text-center font-semibold ${stat.absent > 0 ? 'text-rose-600' : 'text-slate-300'} bg-rose-50/40">${stat.absent}</td>
                    <td class="p-3 text-center font-semibold ${stat.leave > 0 ? 'text-amber-600' : 'text-slate-300'} bg-amber-50/40">${stat.leave}</td>
                    <td class="p-3 text-center font-semibold ${stat.late > 0 ? 'text-orange-600' : 'text-slate-300'} bg-orange-50/40">${stat.late}</td>
                    
                    <td class="p-3 text-center font-medium text-indigo-600 bg-indigo-50/40">${stat.hw > 0 ? stat.hw : '-'}</td>
                    <td class="p-3 text-center font-medium text-purple-600 bg-purple-50/40">${stat.quiz > 0 ? stat.quiz : '-'}</td>
                    <td class="p-3 text-center font-medium text-pink-600 bg-pink-50/40">${stat.bonus > 0 ? stat.bonus : '-'}</td>
                    <td class="p-3 text-center font-bold text-blue-600 bg-blue-100/50">${stat.totalScore.toFixed(1)}</td>
                `;
                tbody.appendChild(tr);
            });
            btnExcel.classList.remove('hidden'); // โชว์ปุ่ม Excel เมื่อมีข้อมูล
        }

        loadingState.classList.add('hidden');
        dashboardContent.classList.remove('hidden');

    } catch (error) {
        console.error('Error loading dashboard:', error);
        loadingState.innerHTML = `<span class="text-rose-500">❌ เกิดข้อผิดพลาด: ${error.message}</span>`;
    }
}

// ==========================================
// ฟังก์ชันส่งออกตารางเป็นไฟล์ Excel
// ==========================================
function exportToExcel() {
    const room = document.getElementById('roomSelect').value;
    const roomText = room === 'all' ? 'ทุกห้อง' : `ห้อง${room}`;
    
    // ตั้งชื่อไฟล์พร้อมวันที่ปัจจุบัน
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `สรุปข้อมูล_ม33201_${roomText}_${dateStr}.xlsx`;

    // อ้างอิงถึง Table ใน HTML และสร้างไฟล์
    const tableElement = document.getElementById("dataTable");
    const workbook = XLSX.utils.table_to_book(tableElement, { sheet: "สรุปคะแนนและเวลาเรียน" });
    
    // ดาวน์โหลด
    XLSX.writeFile(workbook, fileName);
}
