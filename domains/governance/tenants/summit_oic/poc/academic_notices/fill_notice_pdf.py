from __future__ import annotations

import json
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter


STAGE_FIELDS = {
    "week_3": {
        "date": "Date",
        "status_risk": ["is at risk of failing", "Check Box3"],
        "status_recovered": [],
        "status_failed": ["has failed", "Check Box4"],
        "grade_attendance": "Current grade and attendance",
        "actions": "Actions that need to be taken",
        "instructor": "Course Instructor",
    },
    "week_5": {
        "date": "Date_2",
        "status_risk": ["is at risk of failing_2", "Check Box6"],
        "status_recovered": ["is no longer at risk of failing", "Check Box5"],
        "status_failed": ["has failed_2", "Check Box7"],
        "grade_attendance": "Current grade and attendance_2",
        "actions": "Actions that need to be taken_2",
        "instructor": "Course Instructor_2",
    },
    "week_7": {
        "date": "Date_3",
        "status_risk": ["is at risk of failing_3", "Check Box9"],
        "status_recovered": ["is no longer at risk of failing_2", "Check Box8"],
        "status_failed": ["has failed_3", "Check Box10"],
        "grade_attendance": "Current grade and attendance_3",
        "actions": "Actions that need to be taken_3",
        "instructor": "Course Instructor_3",
    },
}


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: fill_notice_pdf.py <payload.json>", file=sys.stderr)
        return 1

    payload_path = Path(sys.argv[1])
    payload = json.loads(payload_path.read_text())

    template_path = Path(payload["template_path"])
    output_path = Path(payload["output_path"])
    stage = payload["stage"]
    status = payload["status"]

    stage_fields = STAGE_FIELDS[stage]

    reader = PdfReader(str(template_path))
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)

    field_values: dict[str, str] = {
        "Name": payload["student_name"],
        "Text1": payload["term_start"],
        "Text2": payload["department"],
        "The following course": payload["course_name"],
        stage_fields["date"]: payload["notice_date"],
        stage_fields["grade_attendance"]: payload["grade_attendance"],
        stage_fields["actions"]: payload["actions"],
        stage_fields["instructor"]: payload["course_instructor"],
    }

    if status == "risk":
        for field in stage_fields["status_risk"]:
            field_values[field] = "/Yes"
    elif status == "recovered":
        for field in stage_fields["status_recovered"]:
            field_values[field] = "/Yes"
    elif status == "failed":
        for field in stage_fields["status_failed"]:
            field_values[field] = "/Yes"

    for page in writer.pages:
      writer.update_page_form_field_values(
          page,
          field_values,
          auto_regenerate=True,
      )

    writer.set_need_appearances_writer(True)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as f:
        writer.write(f)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
