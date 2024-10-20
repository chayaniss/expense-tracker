if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
    .then(() => {
        console.log('Service Worker Registered')
        // Load the GAPI client library and initialize it.
        // gapiInit();
    });
}
 
const CLIENT_ID = '1000167571426-pvvdps5g51kb79ea5t9vuocooqvf8teg.apps.googleusercontent.com'; 
const API_KEY = 'AIzaSyAUvJlgnIvgvbYhn0nUMOynRV-EwGRg86w';   
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

const SPREADSHEET_ID = '1wI2O5bEQ97Bj-1SgdQ1hPHOhkGTXhgoZn_Bn2rT9eEU';

let tokenClient;
let gapiInited = false;
let gisInited = false;
 
document.getElementById('authorize_button').style.visibility = 'hidden';
document.getElementById('signout_button').style.visibility = 'hidden';

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
    });
    authInstance = gapi.auth2.getAuthInstance();
    gapiInited = true;
     
    maybeEnableButtons();
    checkStoredToken();
}

 

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
    });
    gisInited = true;
    maybeEnableButtons();
}

function decodeJwtResponse(token) {
    // Decode the JWT token to get the user information.
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
        atob(base64)
            .split('')
            .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
            .join('')
    );
    return JSON.parse(jsonPayload);
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById('authorize_button').style.visibility = 'visible';
    }
}
let idToken = '';

function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        // Store the token in localStorage
        localStorage.setItem('access_token', gapi.client.getToken().access_token);
        document.getElementById('signout_button').style.visibility = 'visible';
        document.getElementById('authorize_button').innerText = 'Refresh';
        fetchUserEmailWithPeopleApi(); 
        await fetchAndDisplayData(); // Fetch data after successful authorization
    };

    if (gapi.client.getToken() === null) {
        // Check if there's a stored token
        const storedToken = localStorage.getItem('access_token');
        if (storedToken) {
            // Use the stored token
            gapi.client.setToken({ access_token: storedToken });
            document.getElementById('signout_button').style.visibility = 'visible';
            document.getElementById('authorize_button').innerText = 'Refresh';
            fetchAndDisplayData();
        } else {
            // Request a new token with user consent
            tokenClient.requestAccessToken({ prompt: 'consent' });
        }
    } else {
        // Skip display of account chooser and consent dialog for an existing session.
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

async function fetchUserEmailWithPeopleApi() {
    try {
        const accessToken = gapi.client.getToken().access_token;
        const response = await fetch('https://people.googleapis.com/v1/people/me?personFields=emailAddresses', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        const data = await response.json();
        const userEmail = data.emailAddresses[0].value;
        localStorage.setItem('userEmail', userEmail);
        console.log('User email:', userEmail); 
    } catch (error) {
        console.error('Error fetching user email:', error);
    }
}

async function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        localStorage.removeItem('access_token'); // Remove the token from localStorage
        localStorage.removeItem('userEmail');
        // document.getElementById('content').innerText = '';
        document.getElementById('authorize_button').innerText = 'Authorize';
        document.getElementById('signout_button').style.visibility = 'hidden';
    }
}

function checkStoredToken() {
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
        // Use the stored token
        gapi.client.setToken({ access_token: storedToken });
        document.getElementById('signout_button').style.visibility = 'visible';
        document.getElementById('authorize_button').innerText = 'Refresh';
        fetchAndDisplayData(); // Fetch data if the token is valid
    }
}

 
let currentPage = 1;
const itemsPerPage = 5;
let totalPages = 0;
let allRows = [];

async function fetchAndDisplayData() {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A2:D', // Adjust the range to where your data starts
        });
        
        allRows = response.result.values || [];
        totalPages = Math.ceil(allRows.length / itemsPerPage);
        currentPage = 1; // Reset to the first page whenever data is fetched
        updatePaginationButtons();
        displayPage(currentPage);
    } catch (error) {
        console.error('Error fetching data from Google Sheets:', error);
    }
}

function displayPage(page) {
    const expenseList = document.getElementById('expense-list');
    expenseList.innerHTML = ''; // Clear the list before adding new items

    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const rows = allRows.slice(startIndex, endIndex);

    if (rows.length > 0) {
        rows.forEach((row) => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item';

            // Create an image element for the receipt preview
            const img = document.createElement('img');
            img.src = row[3]; // The URL of the uploaded receipt image
            img.alt = 'Receipt Image';
            img.style.maxWidth = '150px'; // Set a maximum width for the image preview
            img.style.marginRight = '10px'; // Add some spacing

            // Create content for the item and amount details
            const content = document.createElement('div');
            content.innerHTML = `<strong>Item:</strong> ${row[1]} <br> 
                                 <strong>Amount:</strong> ${row[2]} <br>
                                 <strong>Date:</strong> ${row[0]}`;

            // Append the image and content to the list item
            listItem.appendChild(img);
            listItem.appendChild(content);

            // Add the list item to the expense list
            expenseList.appendChild(listItem);
        });
    } else {
        const noDataItem = document.createElement('li');
        noDataItem.className = 'list-group-item';
        noDataItem.textContent = 'No expenses found.';
        expenseList.appendChild(noDataItem);
    }

    document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;
}

function updatePaginationButtons() {
    document.getElementById('prev-button').disabled = currentPage === 1;
    document.getElementById('next-button').disabled = currentPage === totalPages || totalPages === 0;
}

document.getElementById('prev-button').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        displayPage(currentPage);
        updatePaginationButtons();
    }
});

document.getElementById('next-button').addEventListener('click', () => {
    if (currentPage < totalPages) {
        currentPage++;
        displayPage(currentPage);
        updatePaginationButtons();
    }
});
 

async function uploadFileToDrive(file) {
    const folderId = '1J1w2xtQnlKWdu7a94F78vY__YY4zVWC7'; // Replace with your folder ID

    const metadata = {
        'name': file.name,
        'mimeType': file.type,
        'parents': [folderId]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const accessToken = gapi.client.getToken().access_token;

    // Upload the file to Google Drive
    const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
        body: form,
    });

    const data = await uploadResponse.json();
    const fileId = data.id;

    // Set the file to be accessible by anyone with the link
    await setFilePermissions(fileId, accessToken);

    // Return the shareable link
    return `https://drive.google.com/uc?id=${fileId}`;
}

// Function to set the file permissions
async function setFilePermissions(fileId, accessToken) {
    const permissions = {
        'role': 'reader', // 'reader' means view-only access
        'type': 'anyone'  // 'anyone' allows anyone with the link to access
    };

    try {
        const permissionResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(permissions)
        });

        if (permissionResponse.ok) {
            console.log('File permissions updated successfully.');
        } else {
            const errorData = await permissionResponse.json();
            console.error('Error setting file permissions:', errorData);
        }
    } catch (error) {
        console.error('Error setting file permissions:', error);
    }
}




// Function to add an expense to Google Sheets
async function addExpenseToSheet(item, amount, receiptUrl) {
 
    const userEmail =   localStorage.getItem('userEmail'); 
    const values = [
        [new Date().toLocaleString(), item, amount, receiptUrl, userEmail]
    ];

    const body = {
        values: values
    };

    try {
        const response = await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A1:E1', // Adjust the range to include the new User ID column
            valueInputOption: 'RAW',
            resource: body,
        });
        console.log('Expense added to sheet:', response);
        alert('Expense added successfully!');
        await fetchAndDisplayData(); // Fetch updated data after adding an expense
    } catch (error) {
        console.error('Error adding expense:', error);
        document.getElementById('content').innerText = error.message;
    }
}


// Add event listener for form submission
document.getElementById('expense-form').addEventListener('submit', async function (event) {
    event.preventDefault();

    const item = document.getElementById('expense-item').value;
    const amount = document.getElementById('expense-amount').value;
    const file = document.getElementById('expense-receipt').files[0];

    if (!file) {
        alert('Please upload a receipt.');
        return;
    }

    try {
        // Upload the image to Google Drive and get the file URL
        const receiptUrl = await uploadFileToDrive(file);

        // Add the expense data to Google Sheets with the receipt URL
        await addExpenseToSheet(item, amount, receiptUrl);
    } catch (error) {
        console.error('Error during upload or saving expense:', error);
        alert('Failed to upload receipt or save expense.');
    }
});
