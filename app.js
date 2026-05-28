/**
 * =============================================================================
 *   THANSHI FARMS MANAGEMENT PORTAL - CORE LOGIC
 *   State, Calculations, Local Storage, CSV/PDF Export, SMS Simulation
 * =============================================================================
 */

// Application State definition
const DEFAULT_STATE = {
    wageLogs: [],         // Daily wage logs
    cocoaSales: [],       // Cocoa sales logs
    generalExpenses: [],  // General expenses logs
    employees: [],        // Permanent employees list
    customCategories: {
        wage: ["Penta", "Palm oil gellalu", "Gaddi mandhu", "Thukku", "Plowing", "Harvesting", "Weeding"],
        expense: ["fertilizer", "machinery", "tools", "seeds", "irrigation", "fuel", "other"]
    },
    sellers: [
        { id: "s1", name: "Thanshi Farms Internal", phone: "" },
        { id: "s2", name: "Sri Laxmi Traders", phone: "9848098480" }
    ],
    smsLogs: [],          // Simulation SMS log outbox
    twilioConfig: {
        sid: "",
        token: "",
        sender: "",
        enabled: false
    }
};

class FarmApp {
    constructor() {
        this.state = DEFAULT_STATE;
        this.activeTab = 'dashboard';
        this.selectedEmployeeId = null;

        // Edit IDs
        this.editingWageId = null;
        this.editingCocoaId = null;
        this.editingExpenseId = null;

        // Base64 receipt storage cache for editing Cocoa sales
        this.activeCocoaReceiptBase64 = "";

        this.init();
    }

    // Initialize Database and UI Event Listeners
    init() {
        this.loadState();
        this.setupNavigation();
        this.setupFinancialYears();
        this.setupEventHandlers();
        this.initFlatpickr();
        this.initCurrencyFormatters();
        this.renderAll();
        
        // Display header date in dd/mm/yyyy format
        const today = new Date();
        document.getElementById('header-date').innerText = this.formatISOToDisplay(this.getISODateString(today));
    }

    // Initialize Flatpickr calendars (dd/mm/yyyy format, backdated/today only)
    initFlatpickr() {
        flatpickr(".date-picker-input", {
            dateFormat: "d/m/Y",
            maxDate: "today",
            allowInput: true,
            altInput: false
        });
    }

    // Helpers to convert display format "dd/mm/yyyy" <-> DB format "yyyy-mm-dd"
    parseFormattedDate(dStr) {
        if (!dStr) return "";
        const parts = dStr.split('/');
        if (parts.length !== 3) return dStr;
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    formatISOToDisplay(isoStr) {
        if (!isoStr) return "";
        const parts = isoStr.split('-');
        if (parts.length !== 3) return isoStr;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    getISODateString(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // Number grouping formatting for Indian digits: e.g. 250000 -> 2,50,000
    formatNumberIndian(numStr) {
        if (!numStr) return '';
        // Split decimal point if present
        let parts = numStr.split('.');
        let integerPart = parts[0].replace(/[^0-9]/g, '');
        
        let lastThree = integerPart.substring(integerPart.length - 3);
        let otherNumbers = integerPart.substring(0, integerPart.length - 3);
        if (otherNumbers !== '') {
            lastThree = ',' + lastThree;
        }
        let formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
        
        if (parts.length > 1) {
            let decimalPart = parts[1].replace(/[^0-9]/g, '').substring(0, 2);
            return formattedInt + '.' + decimalPart;
        }
        return formattedInt;
    }

    // Strip commas for parsing to float
    cleanFloat(valStr) {
        if (!valStr) return 0;
        const clean = valStr.toString().replace(/,/g, '');
        return parseFloat(clean) || 0;
    }

    // Attach real-time formatting listeners to currency inputs
    initCurrencyFormatters() {
        const inputs = document.querySelectorAll('.currency-input');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                let cursorPosition = e.target.selectionStart;
                let originalLength = e.target.value.length;

                // Keep only numbers and single dot
                let rawVal = e.target.value.replace(/[^0-9.]/g, '');
                
                // Prevent multiple dots
                const dotParts = rawVal.split('.');
                if (dotParts.length > 2) {
                    rawVal = dotParts[0] + '.' + dotParts.slice(1).join('');
                }

                if (!rawVal) {
                    e.target.value = '';
                    return;
                }

                let formatted = this.formatNumberIndian(rawVal);
                e.target.value = formatted;

                // Restore cursor placement
                let newLength = formatted.length;
                cursorPosition = cursorPosition + (newLength - originalLength);
                e.target.setSelectionRange(cursorPosition, cursorPosition);
            });
        });
    }

    // Load state from localStorage
    loadState() {
        const stored = localStorage.getItem('thanshi_farms_db');
        if (stored) {
            try {
                this.state = JSON.parse(stored);
                // Ensure backward compatibility
                if (!this.state.customCategories) this.state.customCategories = DEFAULT_STATE.customCategories;
                if (!this.state.sellers) this.state.sellers = DEFAULT_STATE.sellers;
                if (!this.state.smsLogs) this.state.smsLogs = DEFAULT_STATE.smsLogs;
                if (!this.state.twilioConfig) this.state.twilioConfig = DEFAULT_STATE.twilioConfig;
            } catch (e) {
                console.error("Error parsing localStorage data, resetting to defaults", e);
                this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
            }
        } else {
            this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
            this.saveState();
        }
    }

    // Save active state to LocalStorage
    saveState() {
        localStorage.setItem('thanshi_farms_db', JSON.stringify(this.state));
    }

    // Navigation configuration
    setupNavigation() {
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = item.getAttribute('data-tab');
                this.navigateToTab(tab);
            });
        });
    }

    navigateToTab(tabName) {
        this.activeTab = tabName;
        
        // Swap tab classes
        document.querySelectorAll('.menu-item').forEach(el => {
            el.classList.toggle('active', el.getAttribute('data-tab') === tabName);
        });

        document.querySelectorAll('.tab-pane').forEach(el => {
            el.classList.toggle('active', el.id === `tab-${tabName}`);
        });

        // Set top bar title
        const titles = {
            'dashboard': 'Dashboard Summary',
            'wage-tracking': 'Daily Wage Worker Tracking',
            'cocoa-sales': 'Cocoa Sales Portal',
            'expenses': 'General Expenses Tracker',
            'employees': 'Permanent Staff & Salary Directory',
            'settings': 'Preferences & Database Backups'
        };
        document.getElementById('current-section-title').innerText = titles[tabName] || 'Thanshi Farms';

        this.renderAll();
    }

    // Financial Years Setup (June 1st to May 31st)
    setupFinancialYears() {
        const fySelect = document.getElementById('fy-select');
        fySelect.innerHTML = '';

        const currentYear = new Date().getFullYear();
        const startYear = 2024;
        const endYear = Math.max(currentYear + 2, 2028);

        const currentFY = this.getFYString(new Date());

        for (let y = startYear; y < endYear; y++) {
            const fyStr = `${y} - ${y + 1}`;
            const opt = document.createElement('option');
            opt.value = fyStr;
            opt.innerText = `FY ${fyStr}`;
            if (fyStr === currentFY) {
                opt.selected = true;
            }
            fySelect.appendChild(opt);
        }

        fySelect.addEventListener('change', () => {
            this.showToast('FY Swapped', `Displaying records for Financial Year ${fySelect.value}`, 'success');
            this.renderAll();
        });
    }

    // Determine FY String: e.g. "2025 - 2026"
    getFYString(dateInput) {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return "";
        
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-indexed (Jan = 0, June = 5)

        if (month >= 5) {
            return `${year} - ${year + 1}`;
        } else {
            return `${year - 1} - ${year}`;
        }
    }

    // Filter array of records by currently selected financial year
    filterByActiveFY(records, dateField = 'date') {
        const activeFY = document.getElementById('fy-select').value;
        return records.filter(item => {
            return this.getFYString(item[dateField]) === activeFY;
        });
    }

    // Setup form submit logic and modal controls
    setupEventHandlers() {
        const setupModal = (triggerId, modalId, closeId, cancelId) => {
            const modal = document.getElementById(modalId);
            const trigger = document.getElementById(triggerId);
            if (trigger) trigger.addEventListener('click', () => modal.classList.remove('hidden'));
            if (closeId) document.getElementById(closeId).addEventListener('click', () => modal.classList.add('hidden'));
            if (cancelId) document.getElementById(cancelId).addEventListener('click', () => modal.classList.add('hidden'));
        };

        setupModal('sms-panel-toggle', 'modal-sms-panel', 'btn-close-sms-modal', null);
        setupModal(null, 'modal-receipt-viewer', 'btn-close-receipt-modal', 'btn-close-receipt-viewer');
        setupModal('btn-new-employee', 'modal-employee', 'btn-close-emp-modal', 'btn-cancel-emp-modal');

        document.getElementById('btn-add-wage-cat').addEventListener('click', () => {
            document.getElementById('modal-cat-type').value = 'wage';
            document.getElementById('modal-custom-cat').classList.remove('hidden');
        });

        document.getElementById('btn-add-expense-cat').addEventListener('click', () => {
            document.getElementById('modal-cat-type').value = 'expense';
            document.getElementById('modal-custom-cat').classList.remove('hidden');
        });

        document.getElementById('btn-add-seller').addEventListener('click', () => {
            document.getElementById('modal-custom-seller').classList.remove('hidden');
        });

        document.getElementById('btn-close-cat-modal').addEventListener('click', () => document.getElementById('modal-custom-cat').classList.add('hidden'));
        document.getElementById('btn-cancel-cat-modal').addEventListener('click', () => document.getElementById('modal-custom-cat').classList.add('hidden'));
        document.getElementById('btn-close-seller-modal').addEventListener('click', () => document.getElementById('modal-custom-seller').classList.add('hidden'));
        document.getElementById('btn-cancel-seller-modal').addEventListener('click', () => document.getElementById('modal-custom-seller').classList.add('hidden'));

        // Custom Category Submit
        document.getElementById('form-modal-custom-cat').addEventListener('submit', (e) => {
            e.preventDefault();
            const type = document.getElementById('modal-cat-type').value;
            const catName = document.getElementById('custom-cat-name').value.trim();
            
            if (catName) {
                if (!this.state.customCategories[type].includes(catName)) {
                    this.state.customCategories[type].push(catName);
                    this.saveState();
                    this.renderDropdowns();
                    this.showToast('Category Added', `"${catName}" has been added to categories.`, 'success');
                }
                document.getElementById('modal-custom-cat').classList.add('hidden');
                document.getElementById('form-modal-custom-cat').reset();
            }
        });

        // Register Seller Submit
        document.getElementById('form-modal-custom-seller').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('custom-seller-name').value.trim();
            const phone = document.getElementById('custom-seller-phone').value.trim();
            
            if (name) {
                const sellerId = 's_' + Date.now();
                this.state.sellers.push({ id: sellerId, name, phone });
                this.saveState();
                this.renderDropdowns();
                
                document.getElementById('cocoa-seller').value = name;
                document.getElementById('cocoa-seller-phone').value = phone;

                this.showToast('Seller Registered', `"${name}" is registered in directory.`, 'success');
                document.getElementById('modal-custom-seller').classList.add('hidden');
                document.getElementById('form-modal-custom-seller').reset();
            }
        });

        document.getElementById('cocoa-seller').addEventListener('change', (e) => {
            const sellerName = e.target.value;
            const seller = this.state.sellers.find(s => s.name === sellerName);
            if (seller) {
                document.getElementById('cocoa-seller-phone').value = seller.phone;
            }
        });

        // Cocoa Form Calculations Qty/Rate
        const qtyInp = document.getElementById('cocoa-qty');
        const rateInp = document.getElementById('cocoa-rate');
        const autoCalcBox = document.getElementById('cocoa-total-calculated');

        const calculateCocoa = () => {
            const qty = this.cleanFloat(qtyInp.value);
            const rate = this.cleanFloat(rateInp.value);
            const total = qty * rate;
            autoCalcBox.innerText = `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };
        qtyInp.addEventListener('input', calculateCocoa);
        rateInp.addEventListener('input', calculateCocoa);

        // Cocoa Receipt File Upload Image Compression
        const fileInput = document.getElementById('cocoa-receipt');
        const uploadPlaceholder = document.getElementById('receipt-upload-placeholder');
        const previewBox = document.getElementById('receipt-preview-box');
        const thumbnailImg = document.getElementById('receipt-thumbnail');
        const fileNameSpan = document.getElementById('receipt-file-name');
        const removeFileBtn = document.getElementById('btn-remove-receipt');

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            fileNameSpan.innerText = file.name;

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        const MAX_WIDTH = 500;
                        const MAX_HEIGHT = 500;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                            }
                        } else {
                            if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                height = MAX_HEIGHT;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);

                        this.activeCocoaReceiptBase64 = canvas.toDataURL('image/jpeg', 0.7);
                        thumbnailImg.src = this.activeCocoaReceiptBase64;
                        uploadPlaceholder.classList.add('hidden');
                        previewBox.classList.remove('hidden');
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            } else {
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.activeCocoaReceiptBase64 = event.target.result; // Base64 PDF
                    thumbnailImg.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' fill='%23b33925'><path d='M0 64C0 28.7 28.7 0 64 0H224V128c0 17.7 14.3 32 32 32H384V299.6l-94.7 94.7c-8.2 8.2-14 18.5-16.8 29.7l-15 60.1c-2.3 9.3 1.8 19 9.8 24c4.3 2.7 9.2 4 14.1 4c3.9 0 7.8-.8 11.5-2.4l58.1-24.9c11.1-4.8 20.8-12.5 28.1-22.3L512 300.9V160c0-17-6.7-33.3-18.7-45.3L401.3 18.7C389.3 6.7 373 0 356 0H64C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H224c13.3 0 24-10.7 24-24s-10.7-24-24-24H64c-8.8 0-16-7.2-16-16V64z'/></svg>";
                    uploadPlaceholder.classList.add('hidden');
                    previewBox.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        });

        removeFileBtn.addEventListener('click', () => {
            fileInput.value = "";
            this.activeCocoaReceiptBase64 = "";
            uploadPlaceholder.classList.remove('hidden');
            previewBox.classList.add('hidden');
        });

        // Module 1: Daily Wage Worker Log Form Submit (Supports EDIT)
        document.getElementById('wage-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const dateStr = document.getElementById('wage-date').value;
            const date = this.parseFormattedDate(dateStr);
            const menCount = parseInt(document.getElementById('wage-men-count').value) || 0;
            const womenCount = parseInt(document.getElementById('wage-women-count').value) || 0;
            const menRate = this.cleanFloat(document.getElementById('wage-men-rate').value);
            const womenRate = this.cleanFloat(document.getElementById('wage-women-rate').value);
            const category = document.getElementById('wage-category').value;
            const purpose = document.getElementById('wage-purpose').value.trim();
            const paid = document.getElementById('wage-status-paid').checked;

            if (menCount === 0 && womenCount === 0) {
                this.showToast('Validation Error', 'Must record at least 1 male or female worker.', 'error');
                return;
            }

            const totalWage = (menCount * menRate) + (womenCount * womenRate);

            if (this.editingWageId) {
                // Update existing record
                const rec = this.state.wageLogs.find(w => w.id === this.editingWageId);
                if (rec) {
                    rec.date = date;
                    rec.menCount = menCount;
                    rec.womenCount = womenCount;
                    rec.menRate = menRate;
                    rec.womenRate = womenRate;
                    rec.category = category;
                    rec.purpose = purpose;
                    rec.paid = paid;
                    rec.totalWage = totalWage;
                    this.showToast('Log Updated', 'Wage record has been updated.', 'success');
                }
                this.editingWageId = null;
                document.getElementById('wage-form-title').innerHTML = `<i class="fa-solid fa-circle-plus"></i> Record Daily Worker Log`;
                document.getElementById('btn-wage-submit').innerText = "Save Entry";
                document.getElementById('btn-wage-cancel').innerText = "Clear";
            } else {
                // Save new record
                const newRecord = {
                    id: 'w_' + Date.now(),
                    date,
                    menCount,
                    womenCount,
                    menRate,
                    womenRate,
                    category,
                    purpose,
                    paid,
                    totalWage
                };
                this.state.wageLogs.push(newRecord);
                this.showToast('Log Saved', 'Daily wage worker tracking saved.', 'success');
            }

            this.saveState();
            document.getElementById('wage-form').reset();
            this.renderAll();
        });

        // Module 2: Cocoa Sales Form Submit (Supports EDIT)
        document.getElementById('cocoa-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const dateStr = document.getElementById('cocoa-date').value;
            const date = this.parseFormattedDate(dateStr);
            const seller = document.getElementById('cocoa-seller').value;
            const sellerPhone = document.getElementById('cocoa-seller-phone').value.trim();
            const buyer = document.getElementById('cocoa-buyer').value.trim() || "Unknown Buyer";
            const buyerPhone = document.getElementById('cocoa-buyer-phone').value.trim();
            const qty = this.cleanFloat(qtyInp.value);
            const rate = this.cleanFloat(rateInp.value);
            
            if (!seller) {
                this.showToast('Validation Error', 'Seller name is mandatory.', 'error');
                return;
            }

            if (!this.activeCocoaReceiptBase64) {
                this.showToast('Receipt Required', 'You must attach a receipt file.', 'error');
                return;
            }

            const totalAmount = qty * rate;

            if (this.editingCocoaId) {
                // Update
                const rec = this.state.cocoaSales.find(c => c.id === this.editingCocoaId);
                if (rec) {
                    rec.date = date;
                    rec.seller = seller;
                    rec.sellerPhone = sellerPhone;
                    rec.buyer = buyer;
                    rec.buyerPhone = buyerPhone;
                    rec.qty = qty;
                    rec.rate = rate;
                    rec.totalAmount = totalAmount;
                    rec.receipt = this.activeCocoaReceiptBase64;
                    this.showToast('Sale Updated', 'Cocoa transaction updated successfully.', 'success');
                }
                this.editingCocoaId = null;
                document.getElementById('cocoa-form-title').innerHTML = `<i class="fa-solid fa-cash-register"></i> Record Cocoa Beans Sale`;
                document.getElementById('btn-cocoa-submit').innerText = "Record Sale";
                document.getElementById('btn-cocoa-cancel').innerText = "Clear";
                document.getElementById('cocoa-receipt').setAttribute('required', 'true');
                document.getElementById('receipt-upload-label').innerHTML = `Attach Receipt <span class="required">*</span>`;
            } else {
                // New
                const newRecord = {
                    id: 'c_' + Date.now(),
                    date,
                    seller,
                    sellerPhone,
                    buyer,
                    buyerPhone,
                    qty,
                    rate,
                    totalAmount,
                    receipt: this.activeCocoaReceiptBase64
                };
                this.state.cocoaSales.push(newRecord);
                this.showToast('Sale Recorded', `Cocoa sales record saved.`, 'success');
            }

            this.saveState();
            fileInput.value = "";
            this.activeCocoaReceiptBase64 = "";
            uploadPlaceholder.classList.remove('hidden');
            previewBox.classList.add('hidden');
            document.getElementById('cocoa-form').reset();
            autoCalcBox.innerText = "₹0.00";
            this.renderAll();
        });

        // Module 3: General Expenses Form Submit (Supports EDIT)
        document.getElementById('expense-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const dateStr = document.getElementById('expense-date').value;
            const date = this.parseFormattedDate(dateStr);
            const category = document.getElementById('expense-category').value;
            const amount = this.cleanFloat(document.getElementById('expense-amount').value);
            const desc = document.getElementById('expense-desc').value.trim();

            if (this.editingExpenseId) {
                // Update
                const rec = this.state.generalExpenses.find(x => x.id === this.editingExpenseId);
                if (rec) {
                    rec.date = date;
                    rec.category = category;
                    rec.amount = amount;
                    rec.desc = desc;
                    this.showToast('Expense Updated', 'Farm expense log has been updated.', 'success');
                }
                this.editingExpenseId = null;
                document.getElementById('expense-form-title').innerHTML = `<i class="fa-solid fa-cart-shopping"></i> Log Farm Expense`;
                document.getElementById('btn-expense-submit').innerText = "Save Expense";
                document.getElementById('btn-expense-cancel').innerText = "Clear";
            } else {
                // New
                const newRecord = {
                    id: 'e_' + Date.now(),
                    date,
                    category,
                    amount,
                    desc
                };
                this.state.generalExpenses.push(newRecord);
                this.showToast('Expense Saved', `Farm expense of ₹${amount} saved.`, 'success');
            }

            this.saveState();
            document.getElementById('expense-form').reset();
            this.renderAll();
        });

        // Module 5: Permanent Employees Modal Save
        document.getElementById('form-modal-employee').addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('modal-emp-id').value;
            const name = document.getElementById('emp-name').value.trim();
            const phone = document.getElementById('emp-phone').value.trim();
            const startDisplay = document.getElementById('emp-start-date').value;
            const startDate = this.parseFormattedDate(startDisplay);
            const salary = this.cleanFloat(document.getElementById('emp-salary').value);

            if (id) {
                // Edit
                const emp = this.state.employees.find(x => x.id === id);
                if (emp) {
                    emp.name = name;
                    emp.phone = phone;
                    emp.startDate = startDate;
                    emp.salary = salary;
                    this.showToast('Staff Updated', `Staff details for ${name} updated successfully.`, 'success');
                }
            } else {
                // Add new
                const newEmp = {
                    id: 'emp_' + Date.now(),
                    name,
                    phone,
                    startDate,
                    salary,
                    absences: [],
                    advances: []
                };
                this.state.employees.push(newEmp);
                this.selectedEmployeeId = newEmp.id;
                this.showToast('Staff Added', `Registered ${name} as permanent staff.`, 'success');
            }

            this.saveState();
            document.getElementById('modal-employee').classList.add('hidden');
            document.getElementById('form-modal-employee').reset();
            this.renderAll();
        });

        // Employee Absence Record
        document.getElementById('absence-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (!this.selectedEmployeeId) return;

            const dateStr = document.getElementById('abs-date').value;
            const date = this.parseFormattedDate(dateStr);
            const reason = document.getElementById('abs-reason').value.trim() || "Unexcused";
            const sendSMS = document.getElementById('abs-send-sms').checked;

            const emp = this.state.employees.find(x => x.id === this.selectedEmployeeId);
            if (emp) {
                emp.absences.push({
                    id: 'abs_' + Date.now(),
                    date,
                    reason
                });

                this.saveState();
                this.showToast('Absence Logged', `Logged absence for ${emp.name}`, 'success');

                if (sendSMS) {
                    this.dispatchSMSTemplate('abs', emp, { date: dateStr, reason });
                }

                document.getElementById('absence-form').reset();
                this.renderEmployeeWorkspace(emp.id);
            }
        });

        // Employee Advance Record
        document.getElementById('advance-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (!this.selectedEmployeeId) return;

            const dateStr = document.getElementById('adv-date').value;
            const date = this.parseFormattedDate(dateStr);
            const amount = this.cleanFloat(document.getElementById('adv-amount').value);
            const purpose = document.getElementById('adv-purpose').value.trim() || "General Advance";
            const sendSMS = document.getElementById('adv-send-sms').checked;

            const emp = this.state.employees.find(x => x.id === this.selectedEmployeeId);
            if (emp) {
                const totalDrawn = emp.advances.reduce((acc, curr) => acc + curr.amount, 0);
                const remaining = emp.salary - totalDrawn;

                if (amount > remaining) {
                    if (!confirm(`Warning: The drawn amount of ₹${amount.toLocaleString('en-IN')} exceeds the remaining salary balance of ₹${remaining.toLocaleString('en-IN')}. Proceed?`)) {
                        return;
                    }
                }

                emp.advances.push({
                    id: 'adv_' + Date.now(),
                    date,
                    amount,
                    purpose
                });

                this.saveState();
                this.showToast('Advance Logged', `Saved withdrawal of ₹${amount.toLocaleString('en-IN')} for ${emp.name}`, 'success');

                if (sendSMS) {
                    const newTotalDrawn = totalDrawn + amount;
                    const finalBalance = emp.salary - newTotalDrawn;
                    this.dispatchSMSTemplate('adv', emp, { date: dateStr, amount, purpose, balance: finalBalance });
                }

                document.getElementById('advance-form').reset();
                this.renderEmployeeWorkspace(emp.id);
            }
        });

        // Filter bindings
        document.getElementById('wage-filter-cat').addEventListener('change', () => this.renderWageList());
        document.getElementById('cocoa-filter-seller').addEventListener('change', () => this.renderCocoaList());
        document.getElementById('expense-filter-cat').addEventListener('change', () => this.renderExpenseList());

        // CSV triggers
        document.getElementById('btn-wage-export-csv').addEventListener('click', () => this.exportToCSV('wage'));
        document.getElementById('btn-cocoa-export-csv').addEventListener('click', () => this.exportToCSV('cocoa'));
        document.getElementById('btn-expense-export-csv').addEventListener('click', () => this.exportToCSV('expense'));

        // PDF print
        const triggerPrint = (tabName) => {
            const activeFY = document.getElementById('fy-select').value;
            const tabPane = document.getElementById(`tab-${tabName}`);
            tabPane.setAttribute('data-print-fy', activeFY);
            tabPane.setAttribute('data-print-date', this.formatISOToDisplay(this.getISODateString(new Date())));
            window.print();
        };
        document.getElementById('btn-wage-export-pdf').addEventListener('click', () => triggerPrint('wage-tracking'));
        document.getElementById('btn-cocoa-export-pdf').addEventListener('click', () => triggerPrint('cocoa-sales'));
        document.getElementById('btn-expense-export-pdf').addEventListener('click', () => triggerPrint('expenses'));

        // Employee sub-tab switching (Absences / Salary Advances)
        document.addEventListener('click', (e) => {
            const subTabBtn = e.target.closest('.sub-tab');
            if (!subTabBtn) return;
            const targetId = subTabBtn.getAttribute('data-subtab');
            if (!targetId) return;

            // Activate clicked tab button
            document.querySelectorAll('.sub-tab').forEach(btn => btn.classList.remove('active'));
            subTabBtn.classList.add('active');

            // Show correct panel
            document.querySelectorAll('.sub-tab-panel').forEach(panel => panel.classList.remove('active'));
            const targetPanel = document.getElementById(`subtab-${targetId}`);
            if (targetPanel) targetPanel.classList.add('active');
        });

        // Settings events
        document.getElementById('btn-export-db').addEventListener('click', () => this.exportDatabaseJSON());
        document.getElementById('import-db-file').addEventListener('change', (e) => this.importDatabaseJSON(e));
        document.getElementById('btn-clear-db').addEventListener('click', () => {
            if (confirm("Reset database? All records will be lost!")) {
                localStorage.removeItem('thanshi_farms_db');
                this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
                this.saveState();
                this.showToast('Reset Complete', 'Application data cleared.', 'warning');
                setTimeout(() => window.location.reload(), 1200);
            }
        });

        // Twilio preference listeners
        const twilioRadios = document.getElementsByName('sms-mode');
        const twilioConfigArea = document.getElementById('twilio-config-area');
        const updateTwilioView = () => {
            const isApi = document.getElementById('sms-mode-api').checked;
            twilioConfigArea.classList.toggle('hidden', !isApi);
            this.state.twilioConfig.enabled = isApi;
            this.saveState();
        };
        twilioRadios.forEach(rad => rad.addEventListener('change', updateTwilioView));
        
        const saveTwilioConfig = () => {
            this.state.twilioConfig.sid = document.getElementById('tw-sid').value.trim();
            this.state.twilioConfig.token = document.getElementById('tw-token').value.trim();
            this.state.twilioConfig.sender = document.getElementById('tw-sender').value.trim();
            this.saveState();
        };
        document.getElementById('tw-sid').addEventListener('input', saveTwilioConfig);
        document.getElementById('tw-token').addEventListener('input', saveTwilioConfig);
        document.getElementById('tw-sender').addEventListener('input', saveTwilioConfig);
    }

    // EDIT RECORD TRIGGERS
    startEditWage(id) {
        const rec = this.state.wageLogs.find(w => w.id === id);
        if (!rec) return;

        this.editingWageId = id;
        
        // Populate inputs
        document.getElementById('wage-date').value = this.formatISOToDisplay(rec.date);
        document.getElementById('wage-men-count').value = rec.menCount;
        document.getElementById('wage-women-count').value = rec.womenCount;
        document.getElementById('wage-men-rate').value = this.formatNumberIndian(rec.menRate.toString());
        document.getElementById('wage-women-rate').value = this.formatNumberIndian(rec.womenRate.toString());
        document.getElementById('wage-category').value = rec.category;
        document.getElementById('wage-purpose').value = rec.purpose || '';
        document.getElementById('wage-status-paid').checked = rec.paid;

        // Change UI labels
        document.getElementById('wage-form-title').innerHTML = `<i class="fa-solid fa-user-pen"></i> Editing Daily Worker Log`;
        document.getElementById('btn-wage-submit').innerText = "Update Log";
        document.getElementById('btn-wage-cancel').innerText = "Cancel Edit";

        // Scroll to form smoothly
        document.getElementById('wage-form').scrollIntoView({ behavior: 'smooth' });
        this.showToast('Edit Mode Active', 'Populated wage form with details.', 'warning');
    }

    cancelWageEdit() {
        this.editingWageId = null;
        document.getElementById('wage-form-title').innerHTML = `<i class="fa-solid fa-circle-plus"></i> Record Daily Worker Log`;
        document.getElementById('btn-wage-submit').innerText = "Save Entry";
        document.getElementById('btn-wage-cancel').innerText = "Clear";
        document.getElementById('wage-form').reset();
    }

    startEditCocoa(id) {
        const rec = this.state.cocoaSales.find(c => c.id === id);
        if (!rec) return;

        this.editingCocoaId = id;

        // Populate
        document.getElementById('cocoa-date').value = this.formatISOToDisplay(rec.date);
        document.getElementById('cocoa-seller').value = rec.seller;
        document.getElementById('cocoa-seller-phone').value = rec.sellerPhone || '';
        document.getElementById('cocoa-buyer').value = rec.buyer || '';
        document.getElementById('cocoa-buyer-phone').value = rec.buyerPhone || '';
        document.getElementById('cocoa-qty').value = this.formatNumberIndian(rec.qty.toString());
        document.getElementById('cocoa-rate').value = this.formatNumberIndian(rec.rate.toString());
        
        // Auto calculations display
        document.getElementById('cocoa-total-calculated').innerText = `₹${rec.totalAmount.toLocaleString('en-IN')}`;

        // Populate receipt
        this.activeCocoaReceiptBase64 = rec.receipt;
        document.getElementById('receipt-file-name').innerText = "Existing Receipt Loaded (Locked)";
        document.getElementById('receipt-thumbnail').src = rec.receipt.startsWith('data:application/pdf') ? "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='%23b33925'><path d='M0 64H224v64H0z'/></svg>" : rec.receipt;
        document.getElementById('receipt-upload-placeholder').classList.add('hidden');
        document.getElementById('receipt-preview-box').classList.remove('hidden');

        // Since it's edit mode, receipt is already present. Make field not mandatory
        document.getElementById('cocoa-receipt').removeAttribute('required');
        document.getElementById('receipt-upload-label').innerHTML = `Attach Receipt <small class="text-muted">(Optional - Keep current)</small>`;

        // UI Updates
        document.getElementById('cocoa-form-title').innerHTML = `<i class="fa-solid fa-user-pen"></i> Editing Cocoa Sale`;
        document.getElementById('btn-cocoa-submit').innerText = "Update Sale";
        document.getElementById('btn-cocoa-cancel').innerText = "Cancel Edit";

        document.getElementById('cocoa-form').scrollIntoView({ behavior: 'smooth' });
        this.showToast('Edit Mode Active', 'Populated cocoa sale form with details.', 'warning');
    }

    cancelCocoaEdit() {
        this.editingCocoaId = null;
        document.getElementById('cocoa-form-title').innerHTML = `<i class="fa-solid fa-cash-register"></i> Record Cocoa Beans Sale`;
        document.getElementById('btn-cocoa-submit').innerText = "Record Sale";
        document.getElementById('btn-cocoa-cancel').innerText = "Clear";
        
        document.getElementById('cocoa-receipt').setAttribute('required', 'true');
        document.getElementById('receipt-upload-label').innerHTML = `Attach Receipt <span class="required">*</span>`;

        this.activeCocoaReceiptBase64 = "";
        document.getElementById('receipt-upload-placeholder').classList.remove('hidden');
        document.getElementById('receipt-preview-box').classList.add('hidden');
        
        document.getElementById('cocoa-form').reset();
        document.getElementById('cocoa-total-calculated').innerText = "₹0.00";
    }

    startEditExpense(id) {
        const rec = this.state.generalExpenses.find(x => x.id === id);
        if (!rec) return;

        this.editingExpenseId = id;

        // Populate
        document.getElementById('expense-date').value = this.formatISOToDisplay(rec.date);
        document.getElementById('expense-category').value = rec.category;
        document.getElementById('expense-amount').value = this.formatNumberIndian(rec.amount.toString());
        document.getElementById('expense-desc').value = rec.desc;

        // UI
        document.getElementById('expense-form-title').innerHTML = `<i class="fa-solid fa-user-pen"></i> Editing Farm Expense`;
        document.getElementById('btn-expense-submit').innerText = "Update Expense";
        document.getElementById('btn-expense-cancel').innerText = "Cancel Edit";

        document.getElementById('expense-form').scrollIntoView({ behavior: 'smooth' });
        this.showToast('Edit Mode Active', 'Populated expense form.', 'warning');
    }

    cancelExpenseEdit() {
        this.editingExpenseId = null;
        document.getElementById('expense-form-title').innerHTML = `<i class="fa-solid fa-cart-shopping"></i> Log Farm Expense`;
        document.getElementById('btn-expense-submit').innerText = "Save Expense";
        document.getElementById('btn-expense-cancel').innerText = "Clear";
        document.getElementById('expense-form').reset();
    }

    // DISPATCH SIMULATED SMS
    dispatchSMSTemplate(type, employee, data) {
        let msg = "";
        if (type === 'abs') {
            msg = `Dear ${employee.name}, you were marked absent on ${data.date} for reason: ${data.reason}.`;
        } else if (type === 'adv') {
            msg = `Dear ${employee.name}, you withdrew an amount of Rs. ${data.amount.toLocaleString('en-IN')} on ${data.date} for "${data.purpose}". Your remaining balance for the year is Rs. ${data.balance.toLocaleString('en-IN')}.`;
        }

        const logEntry = {
            id: 'sms_' + Date.now(),
            employeeName: employee.name,
            phone: employee.phone,
            message: msg,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: this.formatISOToDisplay(this.getISODateString(new Date()))
        };

        this.state.smsLogs.unshift(logEntry);
        this.saveState();
        
        this.playSMSSound();
        this.showToast(`SMS sent to ${employee.name}`, `"${msg.substring(0, 50)}..."`, 'sms');
        this.renderSMSLogs();
    }

    playSMSSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            
            const playTone = (freq, time, duration) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, time);
                gain.gain.setValueAtTime(0.08, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(time);
                osc.stop(time + duration);
            };

            const now = ctx.currentTime;
            playTone(880, now, 0.12);
            playTone(1320, now + 0.08, 0.25);
        } catch (e) {
            console.warn("Audio Context blocked or unsupported:", e);
        }
    }

    // Render operations
    renderAll() {
        this.renderDropdowns();
        this.renderDashboard();
        this.renderWageList();
        this.renderCocoaList();
        this.renderExpenseList();
        this.renderEmployeeList();
        this.renderSMSLogs();
        this.renderSettingsView();
    }

    renderDropdowns() {
        // Daily Wage Categories Dropdown Form + Filter select
        const wageSelect = document.getElementById('wage-category');
        const wageFilter = document.getElementById('wage-filter-cat');
        const activeWageVal = wageSelect.value;
        const activeFilterVal = wageFilter.value;

        wageSelect.innerHTML = '';
        wageFilter.innerHTML = '<option value="all">All Categories</option>';

        this.state.customCategories.wage.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = cat;
            wageSelect.appendChild(opt);

            const optFil = document.createElement('option');
            optFil.value = cat;
            optFil.innerText = cat;
            wageFilter.appendChild(optFil);
        });

        if (this.state.customCategories.wage.includes(activeWageVal)) wageSelect.value = activeWageVal;
        if (this.state.customCategories.wage.includes(activeFilterVal)) wageFilter.value = activeFilterVal;

        // Cocoa Sellers Dropdown Form + Filter select
        const sellerSelect = document.getElementById('cocoa-seller');
        const sellerFilter = document.getElementById('cocoa-filter-seller');
        const activeSeller = sellerSelect.value;
        const activeSellerFil = sellerFilter.value;

        sellerSelect.innerHTML = '<option value="" disabled selected>-- Select Seller --</option>';
        sellerFilter.innerHTML = '<option value="all">All Sellers</option>';

        this.state.sellers.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.name;
            opt.innerText = s.name;
            sellerSelect.appendChild(opt);

            const optFil = document.createElement('option');
            optFil.value = s.name;
            optFil.innerText = s.name;
            sellerFilter.appendChild(optFil);
        });

        if (this.state.sellers.find(s => s.name === activeSeller)) sellerSelect.value = activeSeller;
        if (activeSellerFil === 'all' || this.state.sellers.find(s => s.name === activeSellerFil)) sellerFilter.value = activeSellerFil;
    }

    // MODULE 4: RENDER CONSOLIDATED DASHBOARD
    renderDashboard() {
        const wages = this.filterByActiveFY(this.state.wageLogs, 'date');
        const cocoa = this.filterByActiveFY(this.state.cocoaSales, 'date');
        const expenses = this.filterByActiveFY(this.state.generalExpenses, 'date');

        const totalRevenue = cocoa.reduce((acc, curr) => acc + curr.totalAmount, 0);
        const totalWages = wages.reduce((acc, curr) => acc + curr.totalWage, 0);
        const unpaidWages = wages.filter(w => !w.paid).reduce((acc, curr) => acc + curr.totalWage, 0);
        const totalGenExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);

        const fmtINR = (val) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('dash-cocoa-revenue').innerText = fmtINR(totalRevenue);
        document.getElementById('dash-cocoa-count').innerText = `${cocoa.length} Cocoa Sales recorded in FY`;
        
        document.getElementById('dash-wage-expenses').innerText = fmtINR(totalWages);
        document.getElementById('dash-wage-unpaid').innerText = `${fmtINR(unpaidWages)} Unpaid/Owed`;
        
        document.getElementById('dash-gen-expenses').innerText = fmtINR(totalGenExpenses);

        document.getElementById('fy-label-chart').innerText = `FY ${document.getElementById('fy-select').value}`;

        this.renderSVGChart(totalRevenue, totalWages, totalGenExpenses);

        // Render Recent Activity Logs
        const recentBox = document.getElementById('dash-recent-activities');
        recentBox.innerHTML = '';

        const mixedLogs = [
            ...wages.map(w => ({ date: w.date, type: 'Wages', desc: `${w.category} (${w.menCount}M / ${w.womenCount}F)`, amount: w.totalWage, isExpense: true })),
            ...cocoa.map(c => ({ date: c.date, type: 'Cocoa Sale', desc: `Sold to: ${c.buyer || 'Unknown'} (${c.qty} kg)`, amount: c.totalAmount, isExpense: false })),
            ...expenses.map(e => ({ date: e.date, type: 'Expense', desc: `${e.category}: ${e.desc.substring(0, 30)}`, amount: e.amount, isExpense: true }))
        ];

        mixedLogs.sort((a,b) => new Date(b.date) - new Date(a.date));

        const displayItems = mixedLogs.slice(0, 8);
        if (displayItems.length === 0) {
            recentBox.innerHTML = '<tr><td colspan="4" class="text-center">No entries recorded for this financial year.</td></tr>';
            return;
        }

        displayItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${this.formatISOToDisplay(item.date)}</td>
                <td><span class="badge ${item.isExpense ? 'badge-warning' : 'badge-success'}">${item.type}</span></td>
                <td>${item.desc}</td>
                <td class="${item.isExpense ? 'danger-text' : 'success-text'}">${item.isExpense ? '-' : '+'}₹${item.amount.toLocaleString('en-IN')}</td>
            `;
            recentBox.appendChild(tr);
        });
    }

    renderSVGChart(rev, wages, expenses) {
        const container = document.getElementById('dashboard-svg-chart');
        container.innerHTML = '';

        const maxVal = Math.max(rev, wages, expenses, 10000);
        const formatAbbr = (val) => {
            if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
            if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
            if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
            return `₹${val}`;
        };

        const width = 500;
        const height = 280;
        const padding = { top: 30, right: 30, bottom: 40, left: 60 };

        const graphWidth = width - padding.left - padding.right;
        const graphHeight = height - padding.top - padding.bottom;

        const categories = [
            { label: "Cocoa Revenue", val: rev, color: "#2d6a4f" },
            { label: "Daily Wages", val: wages, color: "#b33925" },
            { label: "Gen. Expenses", val: expenses, color: "#b58348" }
        ];

        let svgMarkup = `<svg viewBox="0 0 ${width} ${height}" class="bar-chart-svg">`;

        // Grid lines
        const gridSteps = 4;
        for (let i = 0; i <= gridSteps; i++) {
            const ratio = i / gridSteps;
            const y = padding.top + graphHeight - (ratio * graphHeight);
            const gridVal = ratio * maxVal;
            svgMarkup += `
                <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="grid-line" />
                <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" class="axis-text" fill="#5e6f65">${formatAbbr(gridVal)}</text>
            `;
        }

        // Bars
        const barSpacing = 40;
        const barWidth = (graphWidth - (barSpacing * (categories.length - 1))) / categories.length;

        categories.forEach((cat, idx) => {
            const x = padding.left + (idx * (barWidth + barSpacing));
            const barHeightVal = (cat.val / maxVal) * graphHeight;
            const y = padding.top + graphHeight - Math.max(barHeightVal, 0);

            svgMarkup += `
                <g class="chart-group">
                    <rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barHeightVal, 4)}" 
                          rx="6" fill="${cat.color}" class="bar-rect" />
                    <text x="${x + (barWidth / 2)}" y="${padding.top + graphHeight + 20}" 
                          text-anchor="middle" class="axis-text" font-weight="600" fill="#1f2e26">${cat.label}</text>
                    <text x="${x + (barWidth / 2)}" y="${Math.max(y - 8, padding.top + 12)}" 
                          text-anchor="middle" fill="#1f2e26" font-size="11" font-weight="bold">₹${Math.round(cat.val).toLocaleString('en-IN')}</text>
                </g>
            `;
        });

        svgMarkup += `</svg>`;
        container.innerHTML = svgMarkup;
    }

    // MODULE 1: DAILY WAGE LIST RENDER
    renderWageList() {
        const tableBody = document.getElementById('wage-records-tbody');
        const logCountSpan = document.getElementById('wage-log-count');
        const filterVal = document.getElementById('wage-filter-cat').value;

        tableBody.innerHTML = '';
        
        let records = this.filterByActiveFY(this.state.wageLogs, 'date');
        if (filterVal !== 'all') {
            records = records.filter(r => r.category === filterVal);
        }

        records.sort((a, b) => new Date(b.date) - new Date(a.date));

        logCountSpan.innerText = `Showing ${records.length} entries`;

        if (records.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No wage logs found matching filter criteria.</td></tr>';
            return;
        }

        records.forEach(item => {
            const tr = document.createElement('tr');
            const displayDateStr = this.formatISOToDisplay(item.date);
            
            tr.innerHTML = `
                <td><strong>${displayDateStr}</strong></td>
                <td><span class="badge badge-primary">${item.category}</span></td>
                <td><i class="fa-solid fa-person"></i> ${item.menCount}M &nbsp;&nbsp;<i class="fa-solid fa-person-dress"></i> ${item.womenCount}F</td>
                <td>₹${item.menRate.toLocaleString('en-IN')} / ₹${item.womenRate.toLocaleString('en-IN')}</td>
                <td class="text-truncate" style="max-width: 150px;" title="${item.purpose}">${item.purpose || '-'}</td>
                <td><strong>₹${item.totalWage.toLocaleString('en-IN')}</strong></td>
                <td>
                    <button class="badge ${item.paid ? 'badge-success' : 'badge-warning'}" 
                            onclick="app.toggleWagePaymentStatus('${item.id}')" 
                            title="Click to toggle payment status">
                        ${item.paid ? 'Paid' : 'Unpaid'}
                    </button>
                </td>
                <td>
                    <div class="row-actions-group">
                        <button class="btn-row-action edit" onclick="app.startEditWage('${item.id}')" title="Edit Log">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn-row-action delete" onclick="app.deleteRecord('wageLogs', '${item.id}')" title="Delete Log">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    toggleWagePaymentStatus(id) {
        const rec = this.state.wageLogs.find(w => w.id === id);
        if (rec) {
            rec.paid = !rec.paid;
            this.saveState();
            this.showToast('Status Updated', `Wages marked as ${rec.paid ? 'Paid' : 'Unpaid'}.`, 'success');
            this.renderAll();
        }
    }

    // MODULE 2: COCOA SALES LIST RENDER
    renderCocoaList() {
        const tableBody = document.getElementById('cocoa-records-tbody');
        const logCountSpan = document.getElementById('cocoa-log-count');
        const filterVal = document.getElementById('cocoa-filter-seller').value;

        tableBody.innerHTML = '';

        // Always compute ribbon from ALL records in FY (not filtered)
        const allFYRecords = this.filterByActiveFY(this.state.cocoaSales, 'date');
        const totalQty = allFYRecords.reduce((acc, r) => acc + r.qty, 0);
        const totalAmt = allFYRecords.reduce((acc, r) => acc + r.totalAmount, 0);
        const ribbonQtyEl = document.getElementById('cocoa-ribbon-qty');
        const ribbonAmtEl = document.getElementById('cocoa-ribbon-amount');
        if (ribbonQtyEl) ribbonQtyEl.innerText = `${totalQty.toLocaleString('en-IN')} kg`;
        if (ribbonAmtEl) ribbonAmtEl.innerText = `₹${totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        let records = allFYRecords.slice();
        if (filterVal !== 'all') {
            records = records.filter(r => r.seller === filterVal);
        }

        records.sort((a,b) => new Date(b.date) - new Date(a.date));

        logCountSpan.innerText = `${records.length} Cocoa Sales logged`;

        if (records.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No cocoa sale transactions recorded.</td></tr>';
            return;
        }

        records.forEach(item => {
            const tr = document.createElement('tr');
            const displayDateStr = this.formatISOToDisplay(item.date);
            
            tr.innerHTML = `
                <td><strong>${displayDateStr}</strong></td>
                <td>
                    <div><strong>${item.seller}</strong></div>
                    <small class="text-muted">${item.sellerPhone || ''}</small>
                </td>
                <td>
                    <div>${item.buyer || '-'}</div>
                    <small class="text-muted">${item.buyerPhone || ''}</small>
                </td>
                <td>${item.qty.toLocaleString('en-IN')} kg</td>
                <td>₹${item.rate.toLocaleString('en-IN')}</td>
                <td><strong>₹${item.totalAmount.toLocaleString('en-IN')}</strong></td>
                <td>
                    <button class="btn-receipt-view" onclick="app.viewReceipt('${item.id}')" title="View attached receipt image">
                        <i class="fa-solid fa-receipt"></i>
                    </button>
                </td>
                <td>
                    <div class="row-actions-group">
                        <button class="btn-row-action edit" onclick="app.startEditCocoa('${item.id}')" title="Edit Record">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn-row-action delete" onclick="app.deleteRecord('cocoaSales', '${item.id}')" title="Delete Sale Record">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    viewReceipt(saleId) {
        const sale = this.state.cocoaSales.find(s => s.id === saleId);
        if (!sale || !sale.receipt) return;

        const displayBox = document.getElementById('receipt-full-display');
        const dlBtn = document.getElementById('btn-download-receipt');

        if (sale.receipt.startsWith('data:application/pdf')) {
            displayBox.innerHTML = `
                <div class="pdf-mock">
                    <i class="fa-solid fa-file-pdf"></i>
                    <h4>Attached PDF Document</h4>
                    <p>Standard browser sandbox does not preview inline base64 PDFs. Download it below.</p>
                </div>
            `;
        } else {
            displayBox.innerHTML = `<img src="${sale.receipt}" alt="Receipt image">`;
        }
        
        dlBtn.href = sale.receipt;
        dlBtn.download = `Receipt_${sale.seller.replace(/\s+/g, '_')}_${sale.date}.png`;

        document.getElementById('modal-receipt-viewer').classList.remove('hidden');
    }

    // MODULE 3: GENERAL EXPENSES LIST RENDER
    renderExpenseList() {
        const tableBody = document.getElementById('expense-records-tbody');
        const logCountSpan = document.getElementById('expense-log-count');
        const filterVal = document.getElementById('expense-filter-cat').value;

        tableBody.innerHTML = '';
        
        let records = this.filterByActiveFY(this.state.generalExpenses, 'date');
        if (filterVal !== 'all') {
            records = records.filter(r => r.category === filterVal);
        }

        records.sort((a,b) => new Date(b.date) - new Date(a.date));

        logCountSpan.innerText = `${records.length} Expenses logged`;

        if (records.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No farm expenses logged.</td></tr>';
            return;
        }

        records.forEach(item => {
            const tr = document.createElement('tr');
            const displayDateStr = this.formatISOToDisplay(item.date);
            
            tr.innerHTML = `
                <td><strong>${displayDateStr}</strong></td>
                <td><span class="badge badge-warning">${item.category.toUpperCase()}</span></td>
                <td>${item.desc}</td>
                <td><strong>₹${item.amount.toLocaleString('en-IN')}</strong></td>
                <td>
                    <div class="row-actions-group">
                        <button class="btn-row-action edit" onclick="app.startEditExpense('${item.id}')" title="Edit Log">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn-row-action delete" onclick="app.deleteRecord('generalExpenses', '${item.id}')" title="Delete Expense Log">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // MODULE 5: RENDER PERMANENT STAFF DIRECTORY
    renderEmployeeList() {
        const listContainer = document.getElementById('employee-list-container');
        listContainer.innerHTML = '';

        if (this.state.employees.length === 0) {
            listContainer.innerHTML = '<p class="text-center text-muted py-5">No employees registered.</p>';
            document.getElementById('emp-no-selection').classList.remove('hidden');
            document.getElementById('emp-workspace').classList.add('hidden');
            return;
        }

        this.state.employees.forEach(emp => {
            const item = document.createElement('div');
            item.className = `employee-directory-item ${emp.id === this.selectedEmployeeId ? 'active' : ''}`;
            
            const totalDrawn = emp.advances.reduce((acc, curr) => acc + curr.amount, 0);
            const balance = emp.salary - totalDrawn;

            item.innerHTML = `
                <div class="emp-item-brief" onclick="app.selectEmployee('${emp.id}')">
                    <h4>${emp.name}</h4>
                    <span>Salary: ₹${emp.salary.toLocaleString('en-IN')}/yr | Bal: ₹${balance.toLocaleString('en-IN')}</span>
                </div>
                <div class="emp-item-action">
                    <button class="btn-row-action edit" onclick="app.editEmployeeModal('${emp.id}')" title="Edit Staff Details">
                        <i class="fa-solid fa-user-pen"></i>
                    </button>
                    <button class="btn-row-action delete" onclick="app.deleteEmployee('${emp.id}')" title="Delete Staff Directory Item">
                        <i class="fa-solid fa-user-minus"></i>
                    </button>
                </div>
            `;
            listContainer.appendChild(item);
        });

        if (this.selectedEmployeeId) {
            this.renderEmployeeWorkspace(this.selectedEmployeeId);
        } else {
            document.getElementById('emp-no-selection').classList.remove('hidden');
            document.getElementById('emp-workspace').classList.add('hidden');
        }
    }

    selectEmployee(id) {
        this.selectedEmployeeId = id;
        this.renderEmployeeList();
    }

    editEmployeeModal(id) {
        const emp = this.state.employees.find(e => e.id === id);
        if (!emp) return;

        document.getElementById('modal-emp-id').value = emp.id;
        document.getElementById('emp-name').value = emp.name;
        document.getElementById('emp-phone').value = emp.phone;
        document.getElementById('emp-start-date').value = this.formatISOToDisplay(emp.startDate);
        document.getElementById('emp-salary').value = this.formatNumberIndian(emp.salary.toString());

        document.getElementById('modal-emp-title').innerText = "Edit Employee Details";
        document.getElementById('btn-save-emp-modal').innerText = "Save Changes";
        document.getElementById('modal-employee').classList.remove('hidden');
    }

    deleteEmployee(id) {
        if (confirm("Remove employee from directory? Logs will be lost!")) {
            this.state.employees = this.state.employees.filter(e => e.id !== id);
            if (this.selectedEmployeeId === id) this.selectedEmployeeId = null;
            this.saveState();
            this.showToast('Employee Removed', 'Staff deleted from records.', 'warning');
            this.renderAll();
        }
    }

    renderEmployeeWorkspace(id) {
        const emp = this.state.employees.find(e => e.id === id);
        if (!emp) {
            this.selectedEmployeeId = null;
            this.renderEmployeeList();
            return;
        }

        document.getElementById('emp-no-selection').classList.add('hidden');
        document.getElementById('emp-workspace').classList.remove('hidden');

        document.getElementById('emp-profile-name').innerText = emp.name;
        document.getElementById('emp-profile-phone').innerText = emp.phone;
        
        document.getElementById('emp-profile-start').innerText = this.formatISOToDisplay(emp.startDate);

        const totalDrawn = emp.advances.reduce((acc, curr) => acc + curr.amount, 0);
        const balance = emp.salary - totalDrawn;

        const fmtCurrency = (val) => `₹${val.toLocaleString('en-IN')}`;
        document.getElementById('emp-profile-salary').innerText = fmtCurrency(emp.salary);
        document.getElementById('emp-profile-advances').innerText = fmtCurrency(totalDrawn);
        document.getElementById('emp-profile-balance').innerText = fmtCurrency(balance);

        // Render Absences Table
        const absTbody = document.getElementById('emp-absences-tbody');
        absTbody.innerHTML = '';
        
        emp.absences.sort((a,b) => new Date(b.date) - new Date(a.date));

        if (emp.absences.length === 0) {
            absTbody.innerHTML = '<tr><td colspan="3" class="text-center">No absences recorded.</td></tr>';
        } else {
            emp.absences.forEach(abs => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${this.formatISOToDisplay(abs.date)}</strong></td>
                    <td>${abs.reason || 'Unexcused'}</td>
                    <td>
                        <button class="btn-row-action delete" onclick="app.deleteEmployeeSubRecord('absences', '${abs.id}')" title="Delete Log">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                `;
                absTbody.appendChild(tr);
            });
        }

        // Render Advances Table
        const advTbody = document.getElementById('emp-advances-tbody');
        advTbody.innerHTML = '';

        emp.advances.sort((a,b) => new Date(b.date) - new Date(a.date));

        if (emp.advances.length === 0) {
            advTbody.innerHTML = '<tr><td colspan="4" class="text-center">No advances recorded.</td></tr>';
        } else {
            emp.advances.forEach(adv => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${this.formatISOToDisplay(adv.date)}</strong></td>
                    <td class="danger-text"><strong>₹${adv.amount.toLocaleString('en-IN')}</strong></td>
                    <td>${adv.purpose}</td>
                    <td>
                        <button class="btn-row-action delete" onclick="app.deleteEmployeeSubRecord('advances', '${adv.id}')" title="Delete Advance Record">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                `;
                advTbody.appendChild(tr);
            });
        }
    }

    deleteEmployeeSubRecord(subType, subRecordId) {
        if (!this.selectedEmployeeId) return;
        const emp = this.state.employees.find(e => e.id === this.selectedEmployeeId);
        if (emp) {
            if (confirm("Delete this record?")) {
                emp[subType] = emp[subType].filter(x => x.id !== subRecordId);
                this.saveState();
                this.showToast('Record Deleted', 'Successfully updated employee logs.', 'success');
                this.renderAll();
            }
        }
    }

    deleteRecord(stateKey, id) {
        if (confirm("Delete this record permanently?")) {
            this.state[stateKey] = this.state[stateKey].filter(x => x.id !== id);
            this.saveState();
            this.showToast('Record Deleted', 'Item removed from database.', 'success');
            this.renderAll();
        }
    }

    // Render SMS Simulator Logs list
    renderSMSLogs() {
        const badge = document.getElementById('sms-badge-count');
        badge.innerText = this.state.smsLogs.length;

        const container = document.getElementById('sms-log-list');
        container.innerHTML = '';

        if (this.state.smsLogs.length === 0) {
            container.innerHTML = '<p class="text-center text-muted py-5">No simulated messages generated yet.</p>';
            return;
        }

        this.state.smsLogs.forEach((log, idx) => {
            const div = document.createElement('div');
            div.className = 'sms-log-item';
            div.addEventListener('click', () => this.showSMSPreviewInPhone(log));

            div.innerHTML = `
                <div class="sms-log-item-header">
                    <span class="phone"><i class="fa-solid fa-mobile-retro"></i> To: ${log.employeeName} (${log.phone})</span>
                    <span class="time">${log.date} ${log.time}</span>
                </div>
                <div class="msg-preview">${log.message}</div>
            `;
            container.appendChild(div);

            if (idx === 0) {
                this.showSMSPreviewInPhone(log);
            }
        });
    }

    showSMSPreviewInPhone(log) {
        document.getElementById('sms-phone-contact-name').innerText = log.employeeName;
        const chatContainer = document.getElementById('sms-phone-bubbles');
        chatContainer.innerHTML = `
            <div class="sms-system-time">${log.date} ${log.time}</div>
            <div class="sms-bubble sent">
                ${log.message}
            </div>
            <div class="sms-system-time" style="font-size: 0.6rem; color: #52b788; font-weight: bold; margin-top: -6px;">
                <i class="fa-solid fa-circle-check"></i> Delivered via Thanshi Farms Mock Gateway
            </div>
        `;
    }

    renderSettingsView() {
        document.getElementById('tw-sid').value = this.state.twilioConfig.sid || '';
        document.getElementById('tw-token').value = this.state.twilioConfig.token || '';
        document.getElementById('tw-sender').value = this.state.twilioConfig.sender || '';
        document.getElementById('sms-mode-api').checked = this.state.twilioConfig.enabled;
        document.getElementById('sms-mode-sim').checked = !this.state.twilioConfig.enabled;
        document.getElementById('twilio-config-area').classList.toggle('hidden', !this.state.twilioConfig.enabled);
    }

    // JSON export
    exportDatabaseJSON() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        
        const dateTag = new Date().toISOString().slice(0,10);
        dlAnchorElem.setAttribute("download", `Thanshi_Farms_DB_Backup_${dateTag}.json`);
        dlAnchorElem.click();
        this.showToast('Backup Created', 'Database JSON downloaded.', 'success');
    }

    importDatabaseJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedState = JSON.parse(e.target.result);
                if (importedState.wageLogs && importedState.cocoaSales && importedState.generalExpenses) {
                    this.state = importedState;
                    this.saveState();
                    this.showToast('Restore Success', 'Database loaded and synced.', 'success');
                    setTimeout(() => window.location.reload(), 1200);
                } else {
                    this.showToast('Import Error', 'Invalid backup file structure.', 'error');
                }
            } catch (err) {
                this.showToast('Parse Error', 'Failed to read JSON backup.', 'error');
            }
        };
        reader.readAsText(file);
    }

    // CSV generation
    exportToCSV(type) {
        let headers = [];
        let rows = [];
        let filename = "";
        
        const activeFY = document.getElementById('fy-select').value;

        if (type === 'wage') {
            const filterVal = document.getElementById('wage-filter-cat').value;
            let records = this.filterByActiveFY(this.state.wageLogs, 'date');
            if (filterVal !== 'all') {
                records = records.filter(r => r.category === filterVal);
            }
            
            headers = ["Date", "Category", "Men Count", "Women Count", "Wage Men (INR)", "Wage Women (INR)", "Purpose", "Total Wage (INR)", "Payment Status"];
            rows = records.map(r => [
                this.formatISOToDisplay(r.date),
                r.category,
                r.menCount,
                r.womenCount,
                r.menRate,
                r.womenRate,
                `"${(r.purpose || '').replace(/"/g, '""')}"`,
                r.totalWage,
                r.paid ? "Paid" : "Unpaid"
            ]);
            filename = `Wage_Report_FY_${activeFY.replace(/\s+/g, '')}.csv`;

        } else if (type === 'cocoa') {
            const filterVal = document.getElementById('cocoa-filter-seller').value;
            let records = this.filterByActiveFY(this.state.cocoaSales, 'date');
            if (filterVal !== 'all') {
                records = records.filter(r => r.seller === filterVal);
            }

            headers = ["Date", "Seller Name", "Seller Phone", "Buyer Name", "Buyer Phone", "Quantity (kg)", "Rate per kg (INR)", "Total Sales (INR)"];
            rows = records.map(r => [
                this.formatISOToDisplay(r.date),
                `"${r.seller.replace(/"/g, '""')}"`,
                r.sellerPhone || '',
                `"${(r.buyer || '').replace(/"/g, '""')}"`,
                r.buyerPhone || '',
                r.qty,
                r.rate,
                r.totalAmount
            ]);
            filename = `Cocoa_Sales_Report_FY_${activeFY.replace(/\s+/g, '')}.csv`;

        } else if (type === 'expense') {
            const filterVal = document.getElementById('expense-filter-cat').value;
            let records = this.filterByActiveFY(this.state.generalExpenses, 'date');
            if (filterVal !== 'all') {
                records = records.filter(r => r.category === filterVal);
            }

            headers = ["Date", "Category", "Description", "Amount (INR)"];
            rows = records.map(r => [
                this.formatISOToDisplay(r.date),
                r.category,
                `"${r.desc.replace(/"/g, '""')}"`,
                r.amount
            ]);
            filename = `Expenses_Report_FY_${activeFY.replace(/\s+/g, '')}.csv`;
        }

        if (rows.length === 0) {
            this.showToast('Export Cancelled', 'No entries to export.', 'warning');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += headers.join(",") + "\n";
        rows.forEach(r => {
            csvContent += r.join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showToast('Export Success', `Downloaded CSV report: ${filename}`, 'success');
    }

    // Push notification toast
    showToast(title, message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        
        let icon = '<i class="fa-solid fa-circle-check"></i>';
        if (type === 'error') {
            toast.className = 'toast toast-error';
            icon = '<i class="fa-solid fa-circle-exclamation"></i>';
        } else if (type === 'warning') {
            toast.className = 'toast toast-warning';
            icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
        } else if (type === 'sms') {
            toast.className = 'toast toast-sms';
            icon = '<i class="fa-solid fa-mobile-screen-button"></i>';
        } else {
            toast.className = 'toast';
        }

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-body">
                <h5>${title}</h5>
                <p>${message}</p>
            </div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastSlideIn 0.3s reverse forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4500);
    }
}

// Instantiate App
let app;
window.addEventListener('DOMContentLoaded', () => {
    app = new FarmApp();
});
