# Cookbook: Form Automation

**Use case:** Fill and submit any web form — contact forms, job applications, registrations, surveys, checkout flows.

---

## Overview

```
navigate → observe form → map fields → fill fields → review → approve → submit → verify
```

---

## Step-by-Step

### 1. Navigate and Observe

```
navigate(url)
screenshot()
read_screen(mode="accessibility")  ← map all input fields
```

From the a11y tree, extract:
- Field labels and their roles (`textbox`, `combobox`, `checkbox`, `radio`)
- Required fields (`aria-required="true"`, `[required]`)
- Current values (prefilled or empty)
- Submit button location

### 2. Map Data to Fields

Match provided data to form fields by label similarity:
```
"First name" field ← data["first_name"]
"Email" field      ← data["email"]
"Message" field    ← data["message"]
```

Flag any required field with no matching data → ask user before proceeding.

### 3. Fill Fields in Order

Fill top-to-bottom to respect field dependencies (e.g., country → state dropdowns):

```
for each field in form_order:
    if field.type == "text/email/textarea":
        type(session_id, text=value, selector=field.selector)
    elif field.type == "select":
        find_element(selector) → click → find option → click
    elif field.type == "checkbox":
        click(selector) if should_be_checked
    elif field.type == "radio":
        click(correct_radio_option)
```

### 4. Pre-Submit Review

**Always show before submitting:**
```
📋 Ready to submit:

  First name:  Jane
  Last name:   Doe
  Email:       jane@example.com
  Message:     Hello, I'm interested in...
  [Password]:  ••••••••

⚠️  This will submit the form. Confirm? (yes / no / edit field)
```

### 5. Submit and Verify

```
click(selector=submit_button, is_destructive=True)
screenshot()       ← capture post-submit state
read_screen()      ← check for success/error messages
```

Success indicators:
- URL changed to `/thank-you`, `/confirmation`, `/success`
- Text contains "Thank you", "Submitted", "We'll be in touch"
- Form no longer visible

Error indicators:
- Red validation messages near fields
- `[role="alert"]` visible
- Same URL with error query param

### 6. Handle Errors

If validation error:
1. Read error messages next to each flagged field
2. Fix the specific field(s)
3. Re-submit (no need to refill clean fields)

---

## Multi-Step Forms (Wizards)

For paginated forms:
```
page 1: fill → click "Next" → screenshot
page 2: fill → click "Next" → screenshot
...
final page: review → click "Submit" → verify
```

Track which page you're on via:
- Step indicator (`Step 2 of 4`)
- URL change (`/checkout/shipping` → `/checkout/payment`)
- Button label change ("Next" → "Review Order" → "Submit")

---

## Credential Handling

- Check `~~credentials vault` connector first
- If active: fetch by domain/service name, fill silently
- If not active: pause and ask user to enter in browser
- **Never echo passwords in chat or logs**
