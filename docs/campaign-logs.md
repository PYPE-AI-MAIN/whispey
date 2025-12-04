# Campaign Logs Documentation

## Overview

Campaign Logs provide a comprehensive view of all contacts and their call statuses within a campaign. This documentation explains every feature, how to manage campaign logs, update sheets, and configure retry settings.

---

## Table of Contents

1. [Accessing Campaign Logs](#accessing-campaign-logs)
2. [Understanding Campaign Logs Features](#understanding-campaign-logs-features)
3. [Campaign Logs Table](#campaign-logs-table)
4. [Filtering and Searching](#filtering-and-searching)
5. [Exporting to Spreadsheet](#exporting-to-spreadsheet)
6. [Retry Configuration](#retry-configuration)
7. [Status Types](#status-types)
8. [Best Practices](#best-practices)

---

## Accessing Campaign Logs

**Screenshot Recommended:** Campaign list page showing the "View" button next to each campaign.

To access campaign logs:

1. Navigate to your project's Campaigns page
2. Find the campaign you want to view
3. Click on the campaign name or the "View" button
4. You'll be taken to the Campaign Details page which includes the logs section

**Location:** `/[projectId]/campaigns/[campaignId]`

---

## Understanding Campaign Logs Features

### Campaign Statistics Dashboard

**Screenshot Recommended:** The stats cards showing Total Contacts, Processed, Success, and Failed counts.

At the top of the Campaign Details page, you'll see four key metrics:

1. **Total Contacts** - The total number of recipients in your campaign
2. **Processed** - Number of contacts that have been processed (attempted)
3. **Success** - Number of successful calls
4. **Failed** - Number of failed calls

These metrics update in real-time as your campaign progresses.

### Campaign Information Panel

**Screenshot Recommended:** The campaign information card showing status, agent, provider, schedule, and retry configuration.

This panel displays:

- **Status** - Current campaign status (Active, Paused, Completed, etc.)
- **Agent** - The AI agent assigned to this campaign
- **Provider** - The telephony provider being used
- **Schedule** - Days of the week when calls are made
- **Time Window** - The time range (start time - end time) for making calls
- **Timezone** - The timezone for the schedule
- **Retry Configuration** - Shows configured retry settings (see [Retry Configuration](#retry-configuration) section)

---

## Campaign Logs Table

**Screenshot Recommended:** The full logs table with multiple columns visible, showing different statuses.

The Campaign Logs table displays detailed information about each contact in your campaign.

### Standard Columns

The table automatically displays these standard columns:

1. **Status** - Current call status (see [Status Types](#status-types))
2. **Retry Count** - Number of retry attempts made for this contact
3. **Last Call** - Timestamp of the most recent call attempt

### Dynamic Columns

The table also displays columns from your CSV file's `additionalData`. Common columns include:

- **Phone Number** - Contact's phone number
- **Name** - Contact's name
- **Email** - Contact's email address
- **Appointment Date** - If applicable
- **Appointment Time** - If applicable
- **Doctor Name** - If applicable
- **Patient Name** - If applicable
- Any other custom columns from your uploaded CSV

**Note:** The table automatically detects and displays all columns from your CSV file, making it easy to view all recipient information in one place.

### Table Features

- **Horizontal Scrolling** - Scroll horizontally to view all columns
- **Sticky Header** - Column headers remain visible while scrolling
- **Color-Coded Status** - Status badges use color coding for quick identification
- **Pagination** - Use "Load More" button to load additional logs (100 logs per page)

---

## Filtering and Searching

**Screenshot Recommended:** The search bar and filter dropdowns in action.

### Search Functionality

The logs table supports searching across all columns. Simply type in the search box to filter results.

**Search Examples:**
- Phone number: `+91 98765 43210`
- Name: `John Doe`
- Email: `john@example.com`
- Status: `completed`

### Status Filter

Filter logs by call status:
- **All** - Shows all contacts
- **Completed** - Only successful calls
- **Failed** - Only failed calls
- **Pending** - Contacts waiting to be called
- **In Progress** - Calls currently in progress

### Source File Filter

If your campaign has multiple source files, you can filter by the specific file name.

### Sorting

**Screenshot Recommended:** Column headers showing sort indicators.

You can sort the logs table by:
- **Created At** - Sort by when the contact was added (default: newest first)
- **Phone Number** - Alphabetical/numerical sorting
- **Call Status** - Group by status type

Click the column header to toggle between ascending and descending order.

---

## Exporting to Spreadsheet

**Screenshot Recommended:** The export button and the downloaded CSV file open in Excel/Google Sheets.

### How to Export Campaign Logs

1. Navigate to the Campaign Details page
2. Scroll down to the Campaign Logs section
3. Apply any filters or search terms you want (optional)
4. Click the **"Download"** or **"Export"** button (if available in your version)
5. The logs will be downloaded as a CSV file

### Export Format

The exported CSV file includes the following columns:

- Phone Number
- Alternative Number (if available)
- FPO Name (if applicable)
- FPO Login ID (if applicable)
- Status
- Real Attempts
- Source File
- Created At
- Uploaded At
- All additional columns from your CSV file

### Updating the Sheet

**Screenshot Recommended:** Step-by-step process of opening the CSV in Excel/Google Sheets and making edits.

#### Method 1: Manual Update

1. **Export the current logs** using the export feature
2. **Open the CSV file** in Excel, Google Sheets, or any spreadsheet application
3. **Make your edits:**
   - Update phone numbers
   - Add new contacts
   - Modify contact information
   - Change status values (note: status changes in the sheet won't automatically update the campaign)
4. **Save the file** as CSV format
5. **Re-upload** the updated CSV file to create a new campaign or update the existing one

#### Method 2: Direct Database Update (Advanced)

**Note:** This method requires database access and should only be done by administrators.

If you need to update campaign logs directly in the system:
1. Access the campaign logs API endpoint
2. Use the appropriate update methods
3. Ensure data validation is maintained

**Important:** Direct database updates should be done carefully to maintain data integrity.

### Re-importing Updated Data

**Screenshot Recommended:** The CSV upload interface showing file selection and preview.

To re-import updated data:

1. Go to the Campaign Creation page
2. Upload your updated CSV file
3. Review the preview to ensure data is correct
4. Create a new campaign or update the existing one (if update functionality is available)

**Note:** Currently, campaigns cannot be updated after creation. You'll need to create a new campaign with the updated data.

---

## Retry Configuration

**Screenshot Recommended:** The Retry Configuration section showing both error codes with their settings.

### Understanding Retry Configuration

Retry configuration allows you to automatically retry failed calls based on specific error codes. The system supports two main error codes:

### Error Code 480 - Temporarily Unavailable

**What it means:**
- The recipient's phone is temporarily unavailable
- The call could not be completed at that moment
- Common reasons: phone is off, out of coverage area, or network issues

**Configuration:**
- **Delay (minutes):** How long to wait before retrying (0-1440 minutes)
  - Example: If set to 30 minutes, the system will wait 30 minutes before attempting again
- **Max Retries:** Maximum number of retry attempts (0-10)
  - Example: If set to 2, the system will try up to 2 more times after the initial failure

**Default Settings:**
- Delay: 5 minutes
- Max Retries: 2 attempts

**Example Scenario:**
- Initial call fails with error 480
- System waits 5 minutes
- Retry attempt 1: If fails again, wait another 5 minutes
- Retry attempt 2: Final attempt
- If all attempts fail, contact is marked as "Failed"

### Error Code 486 - Busy Here

**What it means:**
- The recipient's phone is busy
- The call was rejected because the line is in use
- Common reasons: person is on another call, call waiting is disabled

**Configuration:**
- **Delay (minutes):** How long to wait before retrying (0-1440 minutes)
  - Example: If set to 15 minutes, the system will wait 15 minutes before attempting again
- **Max Retries:** Maximum number of retry attempts (0-10)
  - Example: If set to 3, the system will try up to 3 more times after the initial failure

**Default Settings:**
- Delay: 5 minutes
- Max Retries: 2 attempts

**Example Scenario:**
- Initial call fails with error 486
- System waits 5 minutes
- Retry attempt 1: If fails again, wait another 5 minutes
- Retry attempt 2: Final attempt
- If all attempts fail, contact is marked as "Failed"

### How to Configure Retry Settings

**Screenshot Recommended:** The Retry Configuration form during campaign creation, showing input fields for delay and max retries.

#### During Campaign Creation

1. Navigate to the Campaign Creation page
2. Scroll to the **"Retry Configuration"** section
3. For each error code (480 and 486):
   - **Delay (minutes):** Enter the number of minutes to wait (0-1440)
     - 0 = Retry immediately
     - 30 = Wait 30 minutes
     - 1440 = Wait 24 hours (maximum)
   - **Max Retries:** Enter the number of retry attempts (0-10)
     - 0 = No retries
     - 2 = Two retry attempts (recommended)
     - 10 = Maximum retries
4. Click **"Send"** to create the campaign with these retry settings

#### Updating Retry Configuration (If Available)

**Note:** Retry configuration is typically set during campaign creation. Check if your version supports updating retry settings for existing campaigns.

If update functionality is available:
1. Go to Campaign Details page
2. Look for "Edit" or "Update Schedule" option
3. Modify the retry configuration
4. Save changes

### Retry Configuration Best Practices

1. **For Error 480 (Temporarily Unavailable):**
   - Recommended delay: 15-30 minutes
   - Recommended retries: 2-3 attempts
   - Reason: Temporary issues often resolve quickly

2. **For Error 486 (Busy Here):**
   - Recommended delay: 10-20 minutes
   - Recommended retries: 2-3 attempts
   - Reason: Person might finish their current call soon

3. **Consider Time Windows:**
   - If your campaign has specific time windows (e.g., 9 AM - 5 PM), ensure retry delays don't push attempts outside this window
   - Example: If it's 4:50 PM and delay is 30 minutes, the retry will be at 5:20 PM (outside window)

4. **Balance Between Persistence and Efficiency:**
   - Too many retries with short delays = excessive attempts
   - Too few retries with long delays = missed opportunities
   - Find the right balance for your use case

---

## Status Types

**Screenshot Recommended:** The logs table showing different status badges in different colors.

The campaign logs display various status types, each with a color-coded badge:

### Status Definitions

1. **Completed** (Green)
   - Call was successfully completed
   - The conversation finished normally

2. **Failed** (Red)
   - Call failed and all retry attempts were exhausted
   - No further attempts will be made

3. **Pending** (Yellow)
   - Contact is waiting to be called
   - Call hasn't been attempted yet

4. **In Progress** (Blue)
   - Call is currently being made
   - Conversation is active

5. **Other Statuses** (Gray)
   - Any other status types specific to your system

### Understanding Status Changes

**Status Flow:**
1. **Pending** → Contact added to campaign
2. **In Progress** → Call attempt initiated
3. **Completed** → Call successful
4. **Failed** → Call failed after all retries exhausted
5. **Pending** (again) → Retry scheduled (if retry configuration allows)

---

## Best Practices

### Managing Campaign Logs

1. **Regular Monitoring:**
   - Check campaign logs regularly to monitor progress
   - Use filters to focus on specific statuses (e.g., only failed calls)

2. **Export Regularly:**
   - Export logs periodically for backup
   - Keep historical records of campaign performance

3. **Analyze Patterns:**
   - Review failed calls to identify common issues
   - Adjust retry configurations based on patterns
   - Update contact information based on findings

### Retry Configuration Tips

1. **Start Conservative:**
   - Begin with default settings (5 minutes, 2 retries)
   - Monitor results and adjust as needed

2. **Consider Business Hours:**
   - Set retry delays that respect business hours
   - Avoid retries outside your campaign's time window

3. **Monitor Retry Count:**
   - Check the "Retry Count" column to see how many attempts were made
   - High retry counts might indicate need for longer delays

### Data Management

1. **Keep CSV Files Updated:**
   - Maintain clean, accurate CSV files
   - Remove invalid phone numbers before uploading
   - Include all necessary columns in your CSV

2. **Backup Your Data:**
   - Export logs before making major changes
   - Keep copies of original CSV files

3. **Document Changes:**
   - Note any manual updates made to logs
   - Track which campaigns used which CSV versions

---

## Troubleshooting

### Common Issues

**Issue: Logs not loading**
- Solution: Refresh the page or check your internet connection
- Check if the campaign is still active

**Issue: Export not working**
- Solution: Ensure you have logs to export
- Try a different browser if issues persist

**Issue: Retry not happening**
- Solution: Check retry configuration settings
- Verify that max retries is greater than 0
- Check if delay minutes is set appropriately

**Issue: Status not updating**
- Solution: Click the "Refresh" button
- Wait a few moments for status to sync

---

## Screenshot Recommendations

To make this documentation more professional and user-friendly, consider adding screenshots for:

1. **Campaign List Page** - Showing where to access campaign logs
2. **Campaign Details Dashboard** - The stats cards and information panel
3. **Campaign Logs Table** - Full table view with multiple columns
4. **Filter and Search Interface** - Showing search bar and filter dropdowns
5. **Export Button and Process** - Downloading and opening CSV file
6. **CSV File in Spreadsheet** - Showing the exported data in Excel/Google Sheets
7. **Retry Configuration Section** - During campaign creation
8. **Status Badges** - Different status types with color coding
9. **Pagination Controls** - "Load More" button and page navigation
10. **Campaign Information Panel** - Showing schedule and retry config details

**Screenshot Guidelines:**
- Use clear, high-resolution images
- Add annotations/arrows to highlight important elements
- Include tooltips or callouts for key features
- Show both light and dark mode if applicable
- Keep file sizes reasonable for web viewing

---

## Additional Resources

- [Campaign Creation Guide](./getting-started.md#campaigns)
- [API Reference](./api-reference.md#campaigns)
- [Dashboard Guide](./dashboard-guide.md)

---

## Support

If you need help with campaign logs:
1. Check this documentation first
2. Review the troubleshooting section
3. Contact your system administrator
4. Refer to the API documentation for advanced use cases

---

**Last Updated:** [Current Date]
**Version:** 1.0

