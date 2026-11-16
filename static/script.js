
// ==========================================
// SEMINAR REGISTRATION SYSTEM
// Frontend JavaScript with Password Protection
// ==========================================

const registrationForm = document.getElementById("registrationForm");
const registrationTable = document.getElementById("registrationTable");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const formMessage = document.getElementById("formMessage");


// ==========================================
// 1. DISPLAY MESSAGES
// ==========================================

function showMessage(message, type) {
    formMessage.textContent = message;

    formMessage.style.background =
        type === "success" ? "#e4f4f0" : "#fdeaea";

    formMessage.style.color =
        type === "success" ? "#087f6e" : "#dc5353";
}


// ==========================================
// 2. REGISTER PARTICIPANT
// ==========================================

registrationForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const participant = {
        student_id: document.getElementById("student_id").value.trim(),
        full_name: document.getElementById("full_name").value.trim(),
        email: document.getElementById("email").value.trim(),
        department: document.getElementById("department").value,
        year: document.getElementById("year").value,
        seminar: document.getElementById("seminar").value
    };

    try {
        const response = await fetch("/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(participant)
        });

        const result = await response.json();

        if (!response.ok) {
            showMessage(result.error || "Registration failed.", "error");
            return;
        }

        showMessage("Registration successful!", "success");

        registrationForm.reset();

        await loadRegistrations();

    } catch (error) {
        showMessage("Unable to connect to the server.", "error");
        console.error(error);
    }
});


// ==========================================
// 3. LOAD REGISTRATIONS
// ==========================================

async function loadRegistrations(search = "") {
    try {
        const response = await fetch(
            `/api/registrations?search=${encodeURIComponent(search)}`
        );

        if (!response.ok) {
            throw new Error("Unable to load registrations");
        }

        const registrations = await response.json();

        displayRegistrations(registrations);

        await updateDashboard();

    } catch (error) {
        registrationTable.innerHTML = `
            <tr>
                <td colspan="8">Unable to load registrations.</td>
            </tr>
        `;

        console.error(error);
    }
}


// ==========================================
// 4. DISPLAY REGISTRATION TABLE
// ==========================================

function displayRegistrations(registrations) {
    registrationTable.innerHTML = "";

    if (registrations.length === 0) {
        registrationTable.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center; padding:25px;">
                    No registrations found.
                </td>
            </tr>
        `;

        return;
    }

    registrations.forEach((student, index) => {
        const row = document.createElement("tr");

        const values = [
            index + 1,
            student.student_id,
            student.full_name,
            student.department,
            student.year,
            student.seminar,
            student.reg_date
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");
        const cancelButton = document.createElement("button");

        cancelButton.textContent = "Cancel";
        cancelButton.className = "delete-btn";

        cancelButton.addEventListener("click", () => {
            cancelRegistration(student.id);
        });

        actionCell.appendChild(cancelButton);
        row.appendChild(actionCell);

        registrationTable.appendChild(row);
    });
}


// ==========================================
// 5. SEARCH REGISTRATIONS
// ==========================================

async function searchRegistrations() {
    const searchValue = searchInput.value.trim();
    await loadRegistrations(searchValue);
}

searchBtn.addEventListener("click", searchRegistrations);
searchInput.addEventListener("input", searchRegistrations);


// ==========================================
// 6. PASSWORD POPUP
// ==========================================

function askCancellationPassword() {

    return new Promise(resolve => {

        // Create popup overlay
        const overlay = document.createElement("div");

        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.65);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            padding: 20px;
        `;

        // Create popup box
        const modal = document.createElement("div");

        modal.style.cssText = `
            background: white;
            width: 100%;
            max-width: 400px;
            padding: 28px;
            border-radius: 14px;
            box-shadow: 0 15px 50px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
        `;

        modal.innerHTML = `
            <h2 style="margin-top:0; color:#17365d;">
                Confirm Cancellation
            </h2>

            <p style="color:#666; line-height:1.5;">
                Enter the administrator password to cancel this registration.
            </p>

            <label style="display:block; margin-bottom:8px; font-weight:bold;">
                Cancellation Password
            </label>

            <input
                type="password"
                id="cancelPasswordInput"
                placeholder="Enter password"
                autocomplete="current-password"
                style="
                    width:100%;
                    box-sizing:border-box;
                    padding:12px;
                    border:1px solid #ccc;
                    border-radius:7px;
                    font-size:15px;
                    margin-bottom:18px;
                "
            >

            <p id="cancelPasswordError"
               style="color:#dc5353; font-size:13px; min-height:16px;">
            </p>

            <div style="display:flex; gap:10px; justify-content:flex-end;">
                <button id="cancelPasswordClose"
                    style="
                        padding:10px 18px;
                        border:1px solid #ccc;
                        background:white;
                        border-radius:7px;
                        cursor:pointer;
                    ">
                    Back
                </button>

                <button id="cancelPasswordSubmit"
                    style="
                        padding:10px 18px;
                        border:none;
                        background:#173f73;
                        color:white;
                        border-radius:7px;
                        cursor:pointer;
                    ">
                    Confirm
                </button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const passwordInput =
            modal.querySelector("#cancelPasswordInput");

        const errorMessage =
            modal.querySelector("#cancelPasswordError");

        const submitButton =
            modal.querySelector("#cancelPasswordSubmit");

        const closeButton =
            modal.querySelector("#cancelPasswordClose");

        function finish(value) {
            overlay.remove();
            resolve(value);
        }

        closeButton.addEventListener("click", () => {
            finish(null);
        });

        overlay.addEventListener("click", event => {
            if (event.target === overlay) {
                finish(null);
            }
        });

        submitButton.addEventListener("click", () => {

            const password = passwordInput.value;

            if (!password) {
                errorMessage.textContent =
                    "Please enter the cancellation password.";
                passwordInput.focus();
                return;
            }

            finish(password);
        });

        passwordInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                submitButton.click();
            }

            if (event.key === "Escape") {
                finish(null);
            }
        });

        passwordInput.focus();
    });
}


// ==========================================
// 7. CANCEL REGISTRATION WITH PASSWORD
// ==========================================

async function cancelRegistration(id) {

    const confirmCancel = confirm(
        "Are you sure you want to cancel this registration?"
    );

    if (!confirmCancel) {
        return;
    }

    const password = await askCancellationPassword();

    if (password === null) {
        return;
    }

    try {

        const response = await fetch(`/api/registrations/${id}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ password: password })
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.error || "Cancellation failed.");
            return;
        }

        showMessage(
            "Registration cancelled successfully!",
            "success"
        );

        await loadRegistrations(searchInput.value.trim());

    } catch (error) {

        alert("Unable to connect to the server.");
        console.error(error);
    }
}


// ==========================================
// 8. UPDATE DASHBOARD STATISTICS
// ==========================================

async function updateDashboard() {

    try {

        const [totalResponse, registrationsResponse] =
            await Promise.all([
                fetch("/api/total"),
                fetch("/api/registrations")
            ]);

        if (!totalResponse.ok || !registrationsResponse.ok) {
            throw new Error("Unable to update dashboard");
        }

        const totalData = await totalResponse.json();
        const registrations = await registrationsResponse.json();

        const departments = new Set(
            registrations.map(student => student.department)
        );

        const seminars = new Set(
            registrations.map(student => student.seminar)
        );

        document.getElementById("totalCount").textContent =
            totalData.total;

        document.getElementById("activeCount").textContent =
            totalData.total;

        document.getElementById("departmentCount").textContent =
            departments.size;

        document.getElementById("seminarCount").textContent =
            seminars.size;

        document.getElementById("tableTotal").textContent =
            `Total: ${totalData.total}`;

    } catch (error) {
        console.error("Dashboard error:", error);
    }
}


// ==========================================
// 9. INITIAL PAGE LOAD
// ==========================================

document.addEventListener("DOMContentLoaded", function () {
    loadRegistrations();
});
