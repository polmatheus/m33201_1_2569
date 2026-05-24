// leave.js
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function showError(msg) {
    const errorDiv = document.getElementById('errorMsg');
    errorDiv.textContent = msg;
    errorDiv.classList.remove('hidden');
    
    // เขย่าหน้าจอเบาๆ เตือนผู้ใช้
    errorDiv.classList.add('animate-pulse');
    setTimeout(() => errorDiv.classList.remove('animate-pulse'), 1000);
}

function hideError() {
    document.getElementById('errorMsg').classList.add('hidden');
}

// ==========================================
// ฟังก์ชันตรวจสอบกฎการลา
// ==========================================
function validateLeaveRules(leaveType, leaveDateStr) {
    const now = new Date();
    const leaveDate = new Date(leaveDateStr);
    
    // ตั้งค่าเวลาเริ่มต้นการลาเป็น 08:00 น. ของวันที่ต้องการลา
    leaveDate.setHours(7, 20, 0, 0); 
    
    const todayStr = now.toISOString().split('T')[0];

    // 1. ตรวจสอบการลาป่วย (ต้องก่อน 07:20 ของวันนั้น)
    if (leaveType === 'ลาป่วย') {
        if (leaveDateStr < todayStr) return "ไม่สามารถลาป่วยย้อนหลังได้";
        if (leaveDateStr === todayStr) {
            const hours = now.getHours();
            const minutes = now.getMinutes();
            if (hours > 7 || (hours === 7 && minutes > 20)) {
                return "หมดเวลาส่งใบลาป่วยสำหรับวันนี้แล้ว (ต้องส่งก่อน 07:20 น.)";
            }
        }
        return "PASS";
    }

    // 2. ตรวจสอบการลากิจ (ต้องแจ้งล่วงหน้า 36 ชั่วโมง ไม่นับเสาร์-อาทิตย์)
    if (leaveType === 'ลากิจ') {
        if (leaveDate <= now) return "การลากิจต้องแจ้งล่วงหน้าเท่านั้น";

        let validHoursCount = 0;
        let tempDate = new Date(now.getTime());

        // คำนวณชั่วโมงโดยบวกไปเรื่อยๆ จนถึงวันที่ลา หากตรงกับเสาร์(6) หรืออาทิตย์(0) จะไม่นับ
        while (tempDate < leaveDate) {
            tempDate.setHours(tempDate.getHours() + 1);
            const dayOfWeek = tempDate.getDay();
            
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { 
                validHoursCount++;
            }
        }

        if (validHoursCount < 36) {
            return `ลากิจต้องแจ้งล่วงหน้าอย่างน้อย 36 ชั่วโมงทำการ (ปัจจุบันนับได้ ${validHoursCount} ชม.) ข้ามวันเสาร์-อาทิตย์`;
        }
        return "PASS";
    }

    // 3. ตรวจสอบลาฉุกเฉิน (ยอมรับทุกกรณี แต่ไม่ควรเป็นอดีตเกินไป)
    if (leaveType === 'ลาฉุกเฉิน') {
        if (leaveDateStr < todayStr) {
             // อนุโลมให้บันทึกย้อนหลังได้ 1 วันสำหรับฉุกเฉิน
             const yesterday = new Date(now);
             yesterday.setDate(yesterday.getDate() - 1);
             if (leaveDateStr < yesterday.toISOString().split('T')[0]) {
                 return "ลาฉุกเฉินไม่สามารถย้อนหลังได้เกิน 1 วัน";
             }
        }
        return "PASS";
    }

    return "กรุณาเลือกประเภทการลา";
}

// ==========================================
// ฟังก์ชันส่งข้อมูลขึ้น Supabase
// ==========================================
async function submitLeave() {
    hideError();

    const stdId = document.getElementById('stdId').value.trim();
    const stdName = document.getElementById('stdName').value.trim();
    const roomNum = document.getElementById('roomNum').value;
    const leaveType = document.getElementById('leaveType').value;
    const leaveDate = document.getElementById('leaveDate').value;
    const leaveReason = document.getElementById('leaveReason').value.trim();

    // 1. เช็คข้อมูลว่าง
    if (!stdId || !stdName || !roomNum || !leaveType || !leaveDate || !leaveReason) {
        showError("⚠️ กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง");
        return;
    }

    // 2. ตรวจสอบกฎเวลาการลา
    const validationResult = validateLeaveRules(leaveType, leaveDate);
    if (validationResult !== "PASS") {
        showError("❌ " + validationResult);
        return;
    }

    // 3. บันทึกข้อมูล
    const btn = document.querySelector('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ กำลังบันทึก...';
    btn.disabled = true;

    try {
        const { error } = await supabaseClient
            .from('m33201_1_2569_student_leaves')
            .insert([{
                std_id: stdId,
                student_name: stdName,
                room_number: roomNum,
                leave_type: leaveType,
                leave_date: leaveDate,
                reason: leaveReason,
                status: 'รออนุมัติ'
            }]);

        if (error) throw error;

        alert("✅ ส่งใบขออนุญาตลาเรียบร้อยแล้ว");
        window.location.reload(); // รีเฟรชหน้าเพื่อเคลียร์ฟอร์ม

    } catch (error) {
        showError("เกิดข้อผิดพลาด: " + error.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
