const ATTENDANCE_UPLOAD_KEY = "payflow_attendance_upload_id";

export function saveAttendanceUploadId(uploadId: string) {
  localStorage.setItem(ATTENDANCE_UPLOAD_KEY, uploadId);
}

export function getAttendanceUploadId() {
  return localStorage.getItem(ATTENDANCE_UPLOAD_KEY);
}

export function clearAttendanceUploadId() {
  localStorage.removeItem(ATTENDANCE_UPLOAD_KEY);
}
