import asyncio
import requests
import json
from datetime import datetime


def test_health_endpoint():
    """Test the health endpoint"""
    print("Testing health endpoint...")
    try:
        response = requests.get("http://localhost:8000/health")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        print("✓ Health endpoint test completed\n")
    except Exception as e:
        print(f"✗ Health endpoint test failed: {e}\n")


def test_generate_photo_card_deck():
    """Test the generate photo card deck endpoint"""
    print("Testing generatePhotoCardDeck endpoint...")
    try:
        headers = {
            "X-API-Key": "your-secret-api-key",
            "Content-Type": "application/json"
        }
        
        payload = {
            "title": "Module 3 — VLAN Trunking (Student Overview)",
            "audience": "student",
            "slide_count": 6,
            "key_points": [
                "What a VLAN is and why it exists",
                "Trunk ports vs access ports",
                "802.1Q tagging basics",
                "Native VLAN and common pitfalls",
                "Verification commands checklist",
                "Quick recap + next steps"
            ],
            "citations": [
                {
                    "title": "Module 3: VLAN Trunking",
                    "url": "https://canvas.instructure.com/courses/123/pages/vlan-trunking",
                    "source_id": "canvas:page:98765",
                    "excerpt": "A trunk port carries traffic for multiple VLANs using tagging."
                }
            ],
            "sharepoint_target": {
                "site_url": "https://tenant.sharepoint.com/sites/CourseHub",
                "folder_path": "Shared Documents/Artifacts"
            },
            "output": {
                "file_name_hint": "Module3_VLAN_Trunking_Deck",
                "include_citations_slide_or_section": True,
                "include_timestamp_in_filename": True
            }
        }
        
        response = requests.post(
            "http://localhost:8000/actions/generatePhotoCardDeck",
            headers=headers,
            data=json.dumps(payload)
        )
        
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error Response: {response.text}")
        print("✓ Photo card deck endpoint test completed\n")
    except Exception as e:
        print(f"✗ Photo card deck endpoint test failed: {e}\n")


def test_generate_study_guide():
    """Test the generate study guide endpoint"""
    print("Testing generateStudyGuide endpoint...")
    try:
        headers = {
            "X-API-Key": "your-secret-api-key",
            "Content-Type": "application/json"
        }
        
        payload = {
            "topic": "VLAN Trunking — Study Guide",
            "audience": "student",
            "format": "docx",
            "length": "short",
            "learning_objectives": [
                "Explain the purpose of VLANs",
                "Differentiate trunk vs access ports",
                "Validate trunk configuration using show commands"
            ],
            "key_terms": ["VLAN", "802.1Q", "trunk port", "access port", "native VLAN"],
            "include_self_check": True,
            "citations": [
                {
                    "title": "Module 3: VLAN Trunking",
                    "url": "https://canvas.instructure.com/courses/123/pages/vlan-trunking"
                }
            ],
            "sharepoint_target": {
                "site_url": "https://tenant.sharepoint.com/sites/CourseHub",
                "folder_path": "Shared Documents/Artifacts"
            }
        }
        
        response = requests.post(
            "http://localhost:8000/actions/generateStudyGuide",
            headers=headers,
            data=json.dumps(payload)
        )
        
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error Response: {response.text}")
        print("✓ Study guide endpoint test completed\n")
    except Exception as e:
        print(f"✗ Study guide endpoint test failed: {e}\n")


def test_generate_rubric_spreadsheet():
    """Test the generate rubric spreadsheet endpoint"""
    print("Testing generateRubricSpreadsheet endpoint...")
    try:
        headers = {
            "X-API-Key": "your-secret-api-key",
            "Content-Type": "application/json"
        }
        
        payload = {
            "template_type": "rubric",
            "title": "Lab 4 — Grading Rubric",
            "columns": ["Criteria", "Description", "Points Possible", "Points Earned", "Notes"],
            "rows": [
                ["Correct trunk config", "Trunk allows VLANs 10,20", "20", "", ""],
                ["Verification output", "show interfaces trunk provided", "10", "", ""]
            ],
            "formulas": {
                "total_points_possible": "=SUM(C2:C50)",
                "total_points_earned": "=SUM(D2:D50)"
            },
            "citations": [
                {
                    "title": "Lab 4 Instructions",
                    "url": "https://canvas.instructure.com/courses/123/assignments/456"
                }
            ],
            "sharepoint_target": {
                "site_url": "https://tenant.sharepoint.com/sites/CourseHub",
                "folder_path": "Shared Documents/Artifacts"
            }
        }
        
        response = requests.post(
            "http://localhost:8000/actions/generateRubricSpreadsheet",
            headers=headers,
            data=json.dumps(payload)
        )
        
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error Response: {response.text}")
        print("✓ Rubric spreadsheet endpoint test completed\n")
    except Exception as e:
        print(f"✗ Rubric spreadsheet endpoint test failed: {e}\n")


def main():
    print("Starting tests for Summit Copilot Skills API...\n")
    
    test_health_endpoint()
    test_generate_photo_card_deck()
    test_generate_study_guide()
    test_generate_rubric_spreadsheet()
    
    print("All tests completed!")


if __name__ == "__main__":
    main()