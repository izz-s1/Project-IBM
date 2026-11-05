/* =====================================================================
   Test Case Generator — Main Script
   Modules:
     1. Constants & State
     2. LocalStorage Persistence
     3. Rule-Based Generator Engine
     4. CRUD Operations
     5. Filter & Search
     6. Rendering / UI
     7. Modal Handlers
     8. Export (CSV & JSON)
     9. Toast Notification
    10. Event Listeners & Init
   ===================================================================== */

/* ===================================================================
   1. CONSTANTS & STATE
   =================================================================== */

const STORAGE_KEY = 'tcg_test_cases';

/** Global application state */
let state = {
  testCases: [],      // All test cases in memory
  filterType: '',
  filterPriority: '',
  filterStatus: '',
  searchQuery: '',
  editingId: null,    // ID of test case being edited (null = new)
  deletingId: null,   // ID of test case pending deletion
};

/* ===================================================================
   2. LOCALSTORAGE PERSISTENCE
   =================================================================== */

/** Load test cases from localStorage into state */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.testCases = raw ? JSON.parse(raw) : [];
  } catch {
    state.testCases = [];
  }
}

/** Persist current state.testCases to localStorage */
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.testCases));
}

/* ===================================================================
   3. RULE-BASED GENERATOR ENGINE
   =================================================================== */

/**
 * Generate a zero-padded ID, e.g. "TC-001"
 * Uses the total count to decide the next number, ensuring uniqueness.
 */
function generateId() {
  const allIds = state.testCases.map(tc => parseInt(tc.id.replace('TC-', ''), 10));
  const max = allIds.length > 0 ? Math.max(...allIds) : 0;
  return `TC-${String(max + 1).padStart(3, '0')}`;
}

/**
 * Returns a generated ID for batch generation during a single session.
 * Increments a temporary counter on top of generateId().
 */
function generateIdOffset(offset) {
  const allIds = state.testCases.map(tc => parseInt(tc.id.replace('TC-', ''), 10));
  const max = allIds.length > 0 ? Math.max(...allIds) : 0;
  return `TC-${String(max + 1 + offset).padStart(3, '0')}`;
}

/* ===================================================================
   KEYWORD DETECTION — maps detected keyword groups to specific templates.
   Each entry has:
     keywords : array of lowercase strings to match against featureName+description
     templates: object keyed by test type (Positive|Negative|Boundary|Edge Case)
                containing an array of test case objects.
   =================================================================== */
const KEYWORD_RULES = [
  /* ---------- LOGIN / AUTH ---------- */
  {
    keywords: ['login', 'log in', 'sign in', 'signin', 'authentication', 'auth'],
    templates: {
      Positive: [
        {
          title: 'Verify login succeeds with valid email and password',
          precondition: 'A registered user account exists with a known email and password.',
          steps: '1. Navigate to the login page.\n2. Enter a valid registered email address.\n3. Enter the correct password.\n4. Click the "Login" button.',
          expected: 'User is authenticated and redirected to the dashboard/home page.',
          priority: 'High',
        },
        {
          title: 'Verify "Remember Me" keeps the session after browser restart',
          precondition: 'A registered user account exists.',
          steps: '1. Navigate to the login page.\n2. Enter valid credentials.\n3. Check the "Remember Me" checkbox.\n4. Click "Login".\n5. Close and reopen the browser.',
          expected: 'User session is persisted and the user remains logged in.',
          priority: 'Medium',
        },
      ],
      Negative: [
        {
          title: 'Verify login fails with incorrect password',
          precondition: 'A registered user account exists.',
          steps: '1. Navigate to the login page.\n2. Enter a valid registered email.\n3. Enter an incorrect password.\n4. Click "Login".',
          expected: 'Login is rejected. An error message "Invalid email or password" is displayed.',
          priority: 'High',
        },
        {
          title: 'Verify login fails with unregistered email',
          precondition: 'The email address used is not registered in the system.',
          steps: '1. Navigate to the login page.\n2. Enter an email that does not exist in the system.\n3. Enter any password.\n4. Click "Login".',
          expected: 'Login is rejected. An error message "Invalid email or password" is displayed.',
          priority: 'High',
        },
        {
          title: 'Verify account is locked after 5 consecutive failed login attempts',
          precondition: 'A registered user account exists.',
          steps: '1. Navigate to the login page.\n2. Enter the correct email and an incorrect password.\n3. Click "Login".\n4. Repeat steps 2–3 five times.',
          expected: 'After the 5th failed attempt, the account is locked and a message "Account locked. Please try again later or reset your password." is shown.',
          priority: 'High',
        },
        {
          title: 'Verify login fails when both email and password fields are empty',
          precondition: 'User is on the login page.',
          steps: '1. Navigate to the login page.\n2. Leave the email and password fields empty.\n3. Click "Login".',
          expected: 'Validation errors are shown for both fields. Login does not proceed.',
          priority: 'High',
        },
      ],
      Boundary: [
        {
          title: 'Verify login with password at minimum length boundary',
          precondition: 'The system enforces a minimum password length (e.g. 8 characters).',
          steps: '1. Navigate to the login page.\n2. Enter a valid email.\n3. Enter a password exactly at the minimum allowed length.\n4. Click "Login".',
          expected: 'Login succeeds if the credentials match; no length-related error is shown.',
          priority: 'Medium',
        },
        {
          title: 'Verify login rejects password shorter than minimum length',
          precondition: 'The system enforces a minimum password length.',
          steps: '1. Navigate to the login page.\n2. Enter a valid email.\n3. Enter a password one character shorter than the minimum.\n4. Click "Login".',
          expected: 'A validation error "Password must be at least N characters" is displayed.',
          priority: 'Medium',
        },
      ],
      'Edge Case': [
        {
          title: 'Verify login with SQL injection attempt in email field',
          precondition: 'User is on the login page.',
          steps: "1. Navigate to the login page.\n2. Enter `' OR '1'='1` in the email field.\n3. Enter any value in the password field.\n4. Click \"Login\".",
          expected: 'Login is rejected. The system does not expose any database error or grant unauthorized access.',
          priority: 'High',
        },
        {
          title: 'Verify login page behavior after browser back button post-logout',
          precondition: 'User has previously logged in and then logged out.',
          steps: '1. Log in with valid credentials.\n2. Log out.\n3. Click the browser back button.',
          expected: 'The user is not re-authenticated. The login page or a session-expired page is shown.',
          priority: 'Medium',
        },
      ],
    },
  },

  /* ---------- REGISTER / SIGN UP ---------- */
  {
    keywords: ['register', 'registration', 'sign up', 'signup', 'create account'],
    templates: {
      Positive: [
        {
          title: 'Verify successful registration with all valid inputs',
          precondition: 'The email address used is not already registered.',
          steps: '1. Navigate to the registration page.\n2. Fill in a valid unique email, a strong password, and all required fields.\n3. Click "Register".',
          expected: 'Account is created successfully. User receives a confirmation email or is redirected to the login/onboarding page.',
          priority: 'High',
        },
        {
          title: 'Verify registration sends a confirmation email',
          precondition: 'Valid email address is used during registration.',
          steps: '1. Complete the registration form with valid data.\n2. Submit the form.\n3. Check the inbox of the registered email.',
          expected: 'A confirmation email is received within a reasonable time.',
          priority: 'Medium',
        },
      ],
      Negative: [
        {
          title: 'Verify registration fails with an already-registered email',
          precondition: 'The email address is already registered in the system.',
          steps: '1. Navigate to the registration page.\n2. Enter an email that is already in use.\n3. Fill other required fields.\n4. Click "Register".',
          expected: 'An error "Email is already registered" is displayed. No duplicate account is created.',
          priority: 'High',
        },
        {
          title: 'Verify registration fails when password and confirm password do not match',
          precondition: 'User is on the registration page.',
          steps: '1. Enter a valid email.\n2. Enter a password.\n3. Enter a different value in the "Confirm Password" field.\n4. Click "Register".',
          expected: 'An error "Passwords do not match" is displayed and the form is not submitted.',
          priority: 'High',
        },
        {
          title: 'Verify registration fails with a weak password',
          precondition: 'The system enforces password strength rules.',
          steps: '1. Navigate to the registration page.\n2. Enter a valid email.\n3. Enter a simple password like "12345678".\n4. Click "Register".',
          expected: 'A password strength error is displayed and registration is blocked.',
          priority: 'Medium',
        },
      ],
      Boundary: [
        {
          title: 'Verify registration with email at maximum allowed length',
          precondition: 'The system has a defined maximum length for email addresses.',
          steps: '1. Navigate to the registration page.\n2. Enter an email address exactly at the maximum character limit.\n3. Fill in other required fields and submit.',
          expected: 'Registration succeeds without any length-related error.',
          priority: 'Medium',
        },
        {
          title: 'Verify registration rejects email exceeding maximum length',
          precondition: 'The system has a defined maximum length for email addresses.',
          steps: '1. Navigate to the registration page.\n2. Enter an email address one character longer than the maximum.\n3. Submit.',
          expected: 'A validation error about email length is displayed.',
          priority: 'Medium',
        },
      ],
      'Edge Case': [
        {
          title: 'Verify registration with email containing uppercase letters',
          precondition: 'User is on the registration page.',
          steps: '1. Enter an email with uppercase letters (e.g. "User@Example.COM").\n2. Complete other fields and submit.',
          expected: 'The system treats the email as case-insensitive and registers successfully.',
          priority: 'Low',
        },
        {
          title: 'Verify registration form handles double-submit (rapid clicks)',
          precondition: 'User fills in valid registration data.',
          steps: '1. Complete the registration form.\n2. Click the "Register" button twice in rapid succession.',
          expected: 'Only one account is created. The second submission is ignored or the button is disabled after the first click.',
          priority: 'Medium',
        },
      ],
    },
  },

  /* ---------- PASSWORD (reset / change) ---------- */
  {
    keywords: ['password', 'forgot password', 'reset password', 'change password'],
    templates: {
      Positive: [
        {
          title: 'Verify successful password reset with valid registered email',
          precondition: 'A registered user account exists.',
          steps: '1. Navigate to the "Forgot Password" page.\n2. Enter the registered email address.\n3. Click "Send Reset Link".\n4. Open the reset link from the email.\n5. Enter and confirm a new password.\n6. Submit.',
          expected: 'Password is reset successfully. User can log in with the new password.',
          priority: 'High',
        },
        {
          title: 'Verify password change from account settings with correct current password',
          precondition: 'User is logged in.',
          steps: '1. Navigate to account settings.\n2. Enter the current password.\n3. Enter and confirm the new password.\n4. Click "Save".',
          expected: 'Password is updated. User may be asked to log in again with the new password.',
          priority: 'High',
        },
      ],
      Negative: [
        {
          title: 'Verify password reset fails for unregistered email',
          precondition: 'The email entered is not registered in the system.',
          steps: '1. Navigate to "Forgot Password".\n2. Enter an unregistered email.\n3. Click "Send Reset Link".',
          expected: 'An error or a neutral message (to avoid user enumeration) is displayed. No reset email is sent.',
          priority: 'High',
        },
        {
          title: 'Verify password change fails when current password is incorrect',
          precondition: 'User is logged in.',
          steps: '1. Navigate to change password in settings.\n2. Enter an incorrect current password.\n3. Enter a new password and confirm.\n4. Click "Save".',
          expected: 'An error "Current password is incorrect" is displayed. Password is not changed.',
          priority: 'High',
        },
        {
          title: 'Verify password reset link expires after the valid period',
          precondition: 'A password reset link has been generated.',
          steps: '1. Wait until the reset link expires (e.g. 24 hours).\n2. Click the expired reset link.',
          expected: 'An error "This link has expired. Please request a new one." is displayed.',
          priority: 'Medium',
        },
      ],
      Boundary: [
        {
          title: 'Verify new password at minimum allowed length is accepted',
          precondition: 'User is on the password reset or change page.',
          steps: '1. Enter a new password exactly at the minimum allowed length.\n2. Confirm the password.\n3. Submit.',
          expected: 'Password is accepted and updated successfully.',
          priority: 'Medium',
        },
        {
          title: 'Verify password one character below minimum length is rejected',
          precondition: 'User is on the password reset or change page.',
          steps: '1. Enter a password one character shorter than the minimum required.\n2. Confirm and submit.',
          expected: 'A validation error about minimum password length is displayed.',
          priority: 'Medium',
        },
      ],
      'Edge Case': [
        {
          title: 'Verify new password cannot be the same as the current password',
          precondition: 'User is on the change password page.',
          steps: '1. Enter the current password in the "Current Password" field.\n2. Enter the exact same password as the new password.\n3. Submit.',
          expected: 'An error "New password must be different from the current password" is displayed.',
          priority: 'Medium',
        },
        {
          title: 'Verify reset link cannot be used twice',
          precondition: 'A password reset link has been generated and used once.',
          steps: '1. Use the reset link to set a new password.\n2. Try to use the same reset link again.',
          expected: 'An error "This link has already been used or is invalid." is displayed.',
          priority: 'Medium',
        },
      ],
    },
  },

  /* ---------- EMAIL ---------- */
  {
    keywords: ['email', 'e-mail', 'email verification', 'email confirmation'],
    templates: {
      Positive: [
        {
          title: 'Verify valid email format is accepted',
          precondition: 'User is on a form that requires an email field.',
          steps: '1. Enter a properly formatted email address (e.g. user@example.com).\n2. Submit the form.',
          expected: 'The email is accepted and the form processes successfully.',
          priority: 'High',
        },
        {
          title: 'Verify email verification link activates the account',
          precondition: 'User has registered and received a verification email.',
          steps: '1. Open the verification email.\n2. Click the verification link.',
          expected: 'The account is activated. User is redirected to a success page or can log in.',
          priority: 'High',
        },
      ],
      Negative: [
        {
          title: 'Verify invalid email format is rejected',
          precondition: 'User is on a form with an email field.',
          steps: '1. Enter an improperly formatted email (e.g. "userexample.com", "user@", "@example.com").\n2. Submit the form.',
          expected: 'A validation error "Please enter a valid email address" is displayed.',
          priority: 'High',
        },
        {
          title: 'Verify empty email field is rejected on required forms',
          precondition: 'The email field is marked as required.',
          steps: '1. Leave the email field empty.\n2. Submit the form.',
          expected: 'A validation error "Email is required" is displayed.',
          priority: 'High',
        },
      ],
      Boundary: [
        {
          title: 'Verify email at maximum allowed length (254 characters) is accepted',
          precondition: 'The system follows RFC 5321 email length limits.',
          steps: '1. Enter an email address exactly 254 characters long.\n2. Submit.',
          expected: 'The email is accepted.',
          priority: 'Medium',
        },
        {
          title: 'Verify email exceeding 254 characters is rejected',
          precondition: 'The system follows RFC 5321 email length limits.',
          steps: '1. Enter an email address 255 characters long.\n2. Submit.',
          expected: 'A validation error about email length is displayed.',
          priority: 'Medium',
        },
      ],
      'Edge Case': [
        {
          title: 'Verify email with plus addressing is accepted (e.g. user+tag@example.com)',
          precondition: 'User is on a form with an email field.',
          steps: '1. Enter an email with plus addressing (e.g. user+test@example.com).\n2. Submit.',
          expected: 'The email is accepted as a valid format.',
          priority: 'Low',
        },
        {
          title: 'Verify email field strips leading/trailing whitespace',
          precondition: 'User is on a form with an email field.',
          steps: '1. Enter a valid email with leading and trailing spaces (e.g. "  user@example.com  ").\n2. Submit.',
          expected: 'The system trims whitespace and processes the email correctly.',
          priority: 'Low',
        },
      ],
    },
  },

  /* ---------- SEARCH ---------- */
  {
    keywords: ['search', 'find', 'filter', 'query', 'lookup'],
    templates: {
      Positive: [
        {
          title: 'Verify search returns correct results for a valid keyword',
          precondition: 'The system has existing data that matches the search keyword.',
          steps: '1. Navigate to the search feature.\n2. Enter a keyword that exists in the dataset.\n3. Submit the search.',
          expected: 'Relevant results matching the keyword are displayed.',
          priority: 'High',
        },
        {
          title: 'Verify search results update dynamically as user types',
          precondition: 'The feature supports real-time / live search.',
          steps: '1. Navigate to the search input.\n2. Begin typing a keyword character by character.\n3. Observe the results panel.',
          expected: 'Results update in real time with each keystroke.',
          priority: 'Medium',
        },
      ],
      Negative: [
        {
          title: 'Verify search shows "no results" message for non-existent keyword',
          precondition: 'The keyword entered does not match any existing data.',
          steps: '1. Navigate to the search feature.\n2. Enter a keyword that does not exist in the dataset.\n3. Submit.',
          expected: 'A friendly "No results found" message is displayed. No error occurs.',
          priority: 'High',
        },
        {
          title: 'Verify search with empty input is handled gracefully',
          precondition: 'User is on the search page.',
          steps: '1. Leave the search input empty.\n2. Click the search button or press Enter.',
          expected: 'The system either shows all results, shows a prompt to enter a keyword, or does nothing — without crashing.',
          priority: 'Medium',
        },
      ],
      Boundary: [
        {
          title: 'Verify search with a single character returns results',
          precondition: 'Data matching a single character exists.',
          steps: '1. Enter a single character in the search field.\n2. Submit.',
          expected: 'Results matching that character are displayed correctly.',
          priority: 'Medium',
        },
        {
          title: 'Verify search with maximum character limit in input',
          precondition: 'The search field has a defined maximum character limit.',
          steps: '1. Enter text at the maximum character limit.\n2. Submit.',
          expected: 'Search executes without errors.',
          priority: 'Low',
        },
      ],
      'Edge Case': [
        {
          title: 'Verify search with special characters does not cause errors',
          precondition: 'User is on the search page.',
          steps: "1. Enter special characters (e.g. %, _, *, ') into the search field.\n2. Submit.",
          expected: 'The system handles the input safely without SQL errors or crashes.',
          priority: 'High',
        },
        {
          title: 'Verify search is case-insensitive',
          precondition: 'Data with mixed-case text exists.',
          steps: '1. Search for a keyword in uppercase.\n2. Search for the same keyword in lowercase.\n3. Compare results.',
          expected: 'Both searches return the same results regardless of letter case.',
          priority: 'Medium',
        },
      ],
    },
  },

  /* ---------- UPLOAD ---------- */
  {
    keywords: ['upload', 'file upload', 'attach', 'attachment', 'import'],
    templates: {
      Positive: [
        {
          title: 'Verify successful file upload with allowed file type and size',
          precondition: 'A file of an accepted type (e.g. PDF, JPG) within the size limit is available.',
          steps: '1. Navigate to the upload feature.\n2. Select a valid file.\n3. Click "Upload".',
          expected: 'File is uploaded successfully. A success message and file preview/link are shown.',
          priority: 'High',
        },
        {
          title: 'Verify upload progress indicator is displayed during upload',
          precondition: 'A valid file is selected for upload.',
          steps: '1. Select a large valid file.\n2. Start the upload.\n3. Observe the UI during upload.',
          expected: 'A progress bar or loading indicator is displayed during the upload process.',
          priority: 'Medium',
        },
      ],
      Negative: [
        {
          title: 'Verify upload is rejected for unsupported file type',
          precondition: 'The system has a defined list of accepted file types.',
          steps: '1. Navigate to the upload feature.\n2. Attempt to upload a file with a disallowed extension (e.g. .exe, .sh).\n3. Click "Upload".',
          expected: 'An error "File type not allowed" is displayed. The file is not uploaded.',
          priority: 'High',
        },
        {
          title: 'Verify upload is rejected when file size exceeds the limit',
          precondition: 'The system has a defined maximum file size limit.',
          steps: '1. Navigate to the upload feature.\n2. Select a file larger than the maximum allowed size.\n3. Click "Upload".',
          expected: 'An error "File size exceeds the maximum limit of X MB" is displayed.',
          priority: 'High',
        },
        {
          title: 'Verify upload fails when no file is selected',
          precondition: 'User is on the upload page.',
          steps: '1. Do not select any file.\n2. Click "Upload".',
          expected: 'A validation message "Please select a file to upload" is displayed.',
          priority: 'Medium',
        },
      ],
      Boundary: [
        {
          title: 'Verify upload succeeds for file exactly at the size limit',
          precondition: 'A file exactly at the maximum allowed size is available.',
          steps: '1. Select a file exactly equal to the maximum allowed file size.\n2. Upload it.',
          expected: 'The file is uploaded successfully.',
          priority: 'Medium',
        },
        {
          title: 'Verify upload fails for file one byte above the size limit',
          precondition: 'The system has a defined maximum file size limit.',
          steps: '1. Prepare a file that is one byte larger than the maximum allowed.\n2. Attempt to upload it.',
          expected: 'An error about the file size is displayed.',
          priority: 'Medium',
        },
      ],
      'Edge Case': [
        {
          title: 'Verify upload handles file with no extension',
          precondition: 'User is on the upload page.',
          steps: '1. Select a file that has no file extension.\n2. Click "Upload".',
          expected: 'The system either rejects it with a clear error or handles it gracefully.',
          priority: 'Low',
        },
        {
          title: 'Verify upload of a file with a very long filename',
          precondition: 'User is on the upload page.',
          steps: '1. Rename a valid file to have a filename of 200+ characters.\n2. Attempt to upload it.',
          expected: 'The system truncates the name or rejects it with a clear message. No crash occurs.',
          priority: 'Low',
        },
      ],
    },
  },

  /* ---------- PAYMENT / CHECKOUT ---------- */
  {
    keywords: ['payment', 'pay', 'checkout', 'transaction', 'billing', 'invoice', 'cart'],
    templates: {
      Positive: [
        {
          title: 'Verify successful payment with a valid credit card',
          precondition: 'User has items in the cart and valid payment details are available.',
          steps: '1. Navigate to the checkout page.\n2. Enter valid card details (card number, expiry, CVV).\n3. Click "Pay Now".',
          expected: 'Payment is processed successfully. An order confirmation and receipt are displayed.',
          priority: 'High',
        },
        {
          title: 'Verify payment receipt is sent to registered email after success',
          precondition: 'User completes a successful payment.',
          steps: '1. Complete a successful payment transaction.\n2. Check the registered email inbox.',
          expected: 'A payment receipt email is received with correct order and amount details.',
          priority: 'Medium',
        },
      ],
      Negative: [
        {
          title: 'Verify payment fails with an expired credit card',
          precondition: 'User has items in the cart.',
          steps: '1. Navigate to the checkout page.\n2. Enter card details with an expiry date in the past.\n3. Click "Pay Now".',
          expected: 'Payment is declined. An error "Card has expired" is displayed.',
          priority: 'High',
        },
        {
          title: 'Verify payment fails with an invalid CVV',
          precondition: 'User has items in the cart.',
          steps: '1. Navigate to checkout.\n2. Enter a valid card number and expiry but an incorrect CVV.\n3. Click "Pay Now".',
          expected: 'Payment is declined. An error "Invalid security code" is displayed.',
          priority: 'High',
        },
        {
          title: 'Verify payment fails with insufficient card balance',
          precondition: 'A card with insufficient funds is used.',
          steps: '1. Navigate to checkout.\n2. Enter card details for a card with insufficient balance.\n3. Click "Pay Now".',
          expected: 'Payment is declined. A message "Insufficient funds" or "Transaction declined" is shown.',
          priority: 'High',
        },
      ],
      Boundary: [
        {
          title: 'Verify payment amount at the minimum chargeable threshold',
          precondition: 'The system has a minimum transaction amount.',
          steps: '1. Add an item worth exactly the minimum transaction amount to the cart.\n2. Proceed to checkout and pay.',
          expected: 'Payment is processed successfully.',
          priority: 'Medium',
        },
        {
          title: 'Verify payment is rejected below minimum transaction amount',
          precondition: 'The system has a minimum transaction amount.',
          steps: '1. Attempt to pay an amount below the minimum threshold.',
          expected: 'An error "Transaction amount is below the minimum required" is displayed.',
          priority: 'Medium',
        },
      ],
      'Edge Case': [
        {
          title: 'Verify page does not expose card details on back-button navigation after payment',
          precondition: 'User has completed a payment.',
          steps: '1. Complete a payment transaction.\n2. Click the browser back button.',
          expected: 'Card details are not visible. The user is redirected away from the payment page.',
          priority: 'High',
        },
        {
          title: 'Verify duplicate payment is prevented on double-click of "Pay Now"',
          precondition: 'User is on the checkout page with valid payment details.',
          steps: '1. Fill in valid payment details.\n2. Click the "Pay Now" button twice rapidly.',
          expected: 'Only one transaction is processed. The button is disabled after the first click.',
          priority: 'High',
        },
      ],
    },
  },
];

/**
 * Detect which keyword rule group matches the given feature name and description.
 * Checks the combined text (lowercased) against each rule's keyword list.
 *
 * @param {string} featureName
 * @param {string} description
 * @returns {object|null} - The first matching KEYWORD_RULES entry, or null if none.
 */
function detectKeywordRule(featureName, description) {
  const combined = (featureName + ' ' + description).toLowerCase();
  return KEYWORD_RULES.find(rule =>
    rule.keywords.some(kw => combined.includes(kw))
  ) || null;
}

/**
 * Rule-based generator.
 * If a keyword group is detected from featureName + description, uses that
 * group's specific templates for the given type.
 * Falls back to generic templates when no keyword matches.
 *
 * @param {string} featureName - Short name of the feature
 * @param {string} description - Feature description / user story
 * @param {string} type        - Test type: Positive | Negative | Boundary | Edge Case
 * @returns {Array<object>}    - Array of generated test case data objects
 */
function generateByType(featureName, description, type) {
  const fn   = featureName.trim();
  const desc = description.trim();

  // --- Try keyword-specific templates first ---
  const matchedRule = detectKeywordRule(fn, desc);
  if (matchedRule && matchedRule.templates[type] && matchedRule.templates[type].length > 0) {
    return matchedRule.templates[type].map(rule => ({
      ...rule,
      type,
    }));
  }

  // --- Generic fallback templates ---
  const fallback = {
    Positive: [
      {
        title: `Verify ${fn} works with valid inputs`,
        precondition: `User has access to the ${fn} feature. System is in a clean state.`,
        steps: `1. Navigate to the ${fn} feature.\n2. Enter valid and required input data.\n3. Submit or confirm the action.\n\n[Context] ${desc}`,
        expected: `The ${fn} executes successfully and the expected result is displayed to the user.`,
        priority: 'High',
      },
      {
        title: `Verify ${fn} displays correct success message`,
        precondition: `Valid data are prepared. ${desc}`,
        steps: `1. Open the ${fn} page.\n2. Fill in all required fields with valid data.\n3. Click the submit button.`,
        expected: `A success notification or confirmation message is shown to the user.`,
        priority: 'Medium',
      },
    ],
    Negative: [
      {
        title: `Verify ${fn} shows error with missing required fields`,
        precondition: `User is on the ${fn} page.`,
        steps: `1. Open the ${fn} page.\n2. Leave all required fields empty.\n3. Click the submit button.\n\n[Context] ${desc}`,
        expected: `Validation error messages are displayed for each required field.`,
        priority: 'High',
      },
      {
        title: `Verify ${fn} rejects invalid input format`,
        precondition: `User is on the ${fn} page.`,
        steps: `1. Open the ${fn} page.\n2. Enter invalid or incorrectly formatted data.\n3. Submit the form.\n\n[Context] ${desc}`,
        expected: `The system displays an appropriate validation error and does not proceed.`,
        priority: 'High',
      },
    ],
    Boundary: [
      {
        title: `Verify ${fn} handles minimum allowed value`,
        precondition: `User is on the ${fn} page.`,
        steps: `1. Open the ${fn} page.\n2. Enter the minimum allowed value in the input field.\n3. Submit the form.\n\n[Context] ${desc}`,
        expected: `The system accepts the minimum value and processes it correctly.`,
        priority: 'Medium',
      },
      {
        title: `Verify ${fn} handles maximum allowed value`,
        precondition: `User is on the ${fn} page.`,
        steps: `1. Open the ${fn} page.\n2. Enter the maximum allowed value in the input field.\n3. Submit the form.\n\n[Context] ${desc}`,
        expected: `The system accepts the maximum value and processes it correctly.`,
        priority: 'Medium',
      },
      {
        title: `Verify ${fn} rejects value just above the maximum`,
        precondition: `User is on the ${fn} page.`,
        steps: `1. Open the ${fn} page.\n2. Enter a value that exceeds the maximum allowed limit by one unit.\n3. Submit the form.\n\n[Context] ${desc}`,
        expected: `The system displays a validation error indicating the value is out of range.`,
        priority: 'High',
      },
    ],
    'Edge Case': [
      {
        title: `Verify ${fn} handles special characters in input`,
        precondition: `User is on the ${fn} page.`,
        steps: `1. Open the ${fn} page.\n2. Enter special characters (e.g. <, >, &, ", ', ;) into input fields.\n3. Submit the form.\n\n[Context] ${desc}`,
        expected: `The system sanitizes or rejects the special characters without crashing.`,
        priority: 'Medium',
      },
      {
        title: `Verify ${fn} handles extremely long input strings`,
        precondition: `User is on the ${fn} page.`,
        steps: `1. Open the ${fn} page.\n2. Paste a string of 1000+ characters into a text input.\n3. Submit the form.\n\n[Context] ${desc}`,
        expected: `The system either truncates, rejects, or handles the oversized input gracefully without errors.`,
        priority: 'Low',
      },
      {
        title: `Verify ${fn} behavior when accessed concurrently`,
        precondition: `Two or more sessions are open in the same browser or different browsers.`,
        steps: `1. Open the ${fn} page in two separate browser tabs.\n2. Perform actions simultaneously in both tabs.\n3. Observe the result in each tab.\n\n[Context] ${desc}`,
        expected: `The system remains consistent and does not produce duplicate or conflicting results.`,
        priority: 'Low',
      },
    ],
  };

  return (fallback[type] || []).map(rule => ({ ...rule, type }));
}

/**
 * Main generation function.
 * Generates test cases for each selected type and adds them to state.
 *
 * @param {string}   featureName - Feature name
 * @param {string}   description - User story / description
 * @param {string[]} types       - Array of selected test types
 * @returns {number}             - Count of newly added test cases
 */
function generateTestCases(featureName, description, types) {
  const newCases = [];
  let offset = 0;

  types.forEach(type => {
    const items = generateByType(featureName, description, type);
    items.forEach(item => {
      newCases.push({
        id:          generateIdOffset(offset),
        title:       item.title,
        precondition: item.precondition,
        steps:       item.steps,
        expected:    item.expected,
        priority:    item.priority,
        type:        item.type,
        status:      'Pending',
        feature:     featureName,
      });
      offset++;
    });
  });

  state.testCases.push(...newCases);
  saveToStorage();
  return newCases.length;
}

/* ===================================================================
   4. CRUD OPERATIONS
   =================================================================== */

/**
 * Add a new test case manually.
 * @param {object} data - Test case fields (without id/status)
 */
function addTestCase(data) {
  const tc = {
    id:          generateId(),
    title:       data.title.trim(),
    precondition: (data.precondition || '').trim(),
    steps:       data.steps.trim(),
    expected:    data.expected.trim(),
    priority:    data.priority,
    type:        data.type,
    status:      data.status || 'Pending',
    feature:     data.feature || '',
  };
  state.testCases.push(tc);
  saveToStorage();
  return tc;
}

/**
 * Update an existing test case by ID.
 * @param {string} id   - Test case ID
 * @param {object} data - Updated fields
 */
function updateTestCase(id, data) {
  const idx = state.testCases.findIndex(tc => tc.id === id);
  if (idx === -1) return;
  state.testCases[idx] = {
    ...state.testCases[idx],
    title:       data.title.trim(),
    precondition: (data.precondition || '').trim(),
    steps:       data.steps.trim(),
    expected:    data.expected.trim(),
    priority:    data.priority,
    type:        data.type,
    status:      data.status,
  };
  saveToStorage();
}

/**
 * Delete a test case by ID.
 * @param {string} id - Test case ID
 */
function deleteTestCase(id) {
  state.testCases = state.testCases.filter(tc => tc.id !== id);
  saveToStorage();
}

/**
 * Update only the status of a test case.
 * @param {string} id     - Test case ID
 * @param {string} status - New status: Pass | Fail | Pending
 */
function setStatus(id, status) {
  const tc = state.testCases.find(tc => tc.id === id);
  if (tc) {
    tc.status = status;
    saveToStorage();
  }
}

/* ===================================================================
   5. FILTER & SEARCH
   =================================================================== */

/**
 * Returns the currently visible (filtered + searched) test cases.
 * @returns {object[]}
 */
function getFilteredTestCases() {
  return state.testCases.filter(tc => {
    const matchType     = !state.filterType     || tc.type     === state.filterType;
    const matchPriority = !state.filterPriority || tc.priority === state.filterPriority;
    const matchStatus   = !state.filterStatus   || tc.status   === state.filterStatus;
    const matchSearch   = !state.searchQuery    ||
      tc.title.toLowerCase().includes(state.searchQuery.toLowerCase());
    return matchType && matchPriority && matchStatus && matchSearch;
  });
}

/* ===================================================================
   6. RENDERING / UI
   =================================================================== */

/**
 * Map a priority string to a CSS badge class.
 */
function priorityBadgeClass(priority) {
  return { High: 'badge-high', Medium: 'badge-medium', Low: 'badge-low' }[priority] || 'badge-low';
}

/**
 * Map a type string to a CSS badge class.
 */
function typeBadgeClass(type) {
  return {
    'Positive':   'badge-positive',
    'Negative':   'badge-negative',
    'Boundary':   'badge-boundary',
    'Edge Case':  'badge-edge',
  }[type] || 'badge-positive';
}

/**
 * Map a status string to a CSS status-select class.
 */
function statusSelectClass(status) {
  return {
    Pass:    'status-pass',
    Fail:    'status-fail',
    Pending: 'status-pending',
  }[status] || 'status-pending';
}

/**
 * Build the HTML string for a single test case card.
 * @param {object} tc - Test case object
 * @returns {string}  - HTML string
 */
function buildCardHTML(tc) {
  const pBadge = priorityBadgeClass(tc.priority);
  const tBadge = typeBadgeClass(tc.type);
  const sSel   = statusSelectClass(tc.status);

  return `
    <article class="tc-card" data-id="${tc.id}" aria-label="Test case ${tc.id}">
      <!-- Card Header -->
      <div class="tc-card-header">
        <button class="btn-expand flex-shrink-0 mt-0.5" aria-expanded="false" aria-controls="body-${tc.id}" title="Toggle details">
          <i class="chevron text-slate-400 text-xs select-none">&#9660;</i>
        </button>
        <!-- Title + badges column, and actions row below on mobile -->
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <span class="text-xs font-bold text-primary/70 tracking-wide">${escHtml(tc.id)}</span>
            <span class="badge ${pBadge}">${escHtml(tc.priority)}</span>
            <span class="badge ${tBadge}">${escHtml(tc.type)}</span>
            <!-- Actions: shown inline on sm+ screens, hidden on mobile -->
            <div class="tc-card-actions-inline ml-auto flex items-center gap-1">
              <select class="status-select ${sSel}" data-id="${tc.id}" aria-label="Set status for ${escHtml(tc.id)}">
                <option ${tc.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option ${tc.status === 'Pass'    ? 'selected' : ''}>Pass</option>
                <option ${tc.status === 'Fail'    ? 'selected' : ''}>Fail</option>
              </select>
              <button class="btn-icon btn-edit" data-id="${tc.id}" title="Edit test case" aria-label="Edit ${escHtml(tc.id)}">
                <svg width="15" height="15" fill="none" stroke="#64748B" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/>
                </svg>
              </button>
              <button class="btn-icon danger btn-delete" data-id="${tc.id}" title="Delete test case" aria-label="Delete ${escHtml(tc.id)}">
                <svg width="15" height="15" fill="none" stroke="#EF4444" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6h18M9 6V4h6v2M10 11v6M14 11v6M5 6l1 14h12l1-14"/>
                </svg>
              </button>
            </div>
          </div>
          <p class="text-sm font-semibold text-slate-800 leading-snug">${escHtml(tc.title)}</p>
          <!-- Actions row: shown below title on mobile only -->
          <div class="tc-card-actions-mobile flex items-center gap-2 mt-2">
            <select class="status-select ${sSel}" data-id="${tc.id}" aria-label="Set status for ${escHtml(tc.id)}">
              <option ${tc.status === 'Pending' ? 'selected' : ''}>Pending</option>
              <option ${tc.status === 'Pass'    ? 'selected' : ''}>Pass</option>
              <option ${tc.status === 'Fail'    ? 'selected' : ''}>Fail</option>
            </select>
            <button class="btn-icon btn-edit" data-id="${tc.id}" title="Edit test case" aria-label="Edit ${escHtml(tc.id)}">
              <svg width="15" height="15" fill="none" stroke="#64748B" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/>
              </svg>
            </button>
            <button class="btn-icon danger btn-delete" data-id="${tc.id}" title="Delete test case" aria-label="Delete ${escHtml(tc.id)}">
              <svg width="15" height="15" fill="none" stroke="#EF4444" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18M9 6V4h6v2M10 11v6M14 11v6M5 6l1 14h12l1-14"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Card Body (collapsible) -->
      <div class="tc-card-body" id="body-${tc.id}">
        ${tc.precondition ? `
        <div class="detail-row">
          <span class="detail-label">Precondition</span>
          <span class="detail-value">${escHtml(tc.precondition)}</span>
        </div>` : ''}
        <div class="detail-row">
          <span class="detail-label">Test Steps</span>
          <span class="detail-value">${escHtml(tc.steps)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Expected Result</span>
          <span class="detail-value">${escHtml(tc.expected)}</span>
        </div>
        <div class="detail-row pb-3">
          <span class="detail-label">Feature</span>
          <span class="detail-value">${escHtml(tc.feature || '—')}</span>
        </div>
      </div>
    </article>
  `;
}

/**
 * Render the full test case list based on current filters.
 * Updates the counter badge as well.
 */
function renderList() {
  const list      = document.getElementById('tc-list');
  const empty     = document.getElementById('empty-state');
  const countBadge = document.getElementById('tc-count');

  const visible = getFilteredTestCases();
  countBadge.textContent = visible.length;

  if (visible.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'flex';
  } else {
    empty.style.display = 'none';
    list.innerHTML = visible.map(buildCardHTML).join('');
    attachCardListeners();
  }
}

/**
 * Attach event listeners to dynamically rendered card elements
 * (expand toggle, status change, edit, delete).
 */
function attachCardListeners() {
  // Expand / collapse
  document.querySelectorAll('.btn-expand').forEach(btn => {
    btn.addEventListener('click', () => {
      const card   = btn.closest('.tc-card');
      const bodyId = btn.getAttribute('aria-controls');
      const body   = document.getElementById(bodyId);
      const chevron = btn.querySelector('.chevron');
      const isOpen  = body.classList.toggle('open');
      chevron.classList.toggle('open', isOpen);
      btn.setAttribute('aria-expanded', isOpen);
    });
  });

  // Status change
  document.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const id = sel.dataset.id;
      setStatus(id, sel.value);
      // Update the select styling immediately
      sel.className = `status-select ${statusSelectClass(sel.value)}`;
      showToast(`Status updated to "${sel.value}"`);
    });
  });

  // Edit button
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });

  // Delete button
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
  });
}

/**
 * HTML-escape a string to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ===================================================================
   7. MODAL HANDLERS
   =================================================================== */

/** Open the edit modal pre-filled with a test case's data */
function openEditModal(id) {
  const tc = state.testCases.find(tc => tc.id === id);
  if (!tc) return;

  state.editingId = id;
  document.getElementById('modal-title').textContent  = `Edit Test Case — ${id}`;
  document.getElementById('modal-tc-id').value        = id;
  document.getElementById('modal-title-input').value  = tc.title;
  document.getElementById('modal-precondition').value = tc.precondition;
  document.getElementById('modal-steps').value        = tc.steps;
  document.getElementById('modal-expected').value     = tc.expected;
  document.getElementById('modal-priority').value     = tc.priority;
  document.getElementById('modal-type').value         = tc.type;
  document.getElementById('modal-status').value       = tc.status;
  clearModalErrors();
  showModal();
}

/** Open the edit modal in "Add Manual" mode */
function openAddModal() {
  state.editingId = null;
  document.getElementById('modal-title').textContent  = 'Add Test Case Manually';
  document.getElementById('modal-tc-id').value        = '';
  document.getElementById('modal-title-input').value  = '';
  document.getElementById('modal-precondition').value = '';
  document.getElementById('modal-steps').value        = '';
  document.getElementById('modal-expected').value     = '';
  document.getElementById('modal-priority').value     = 'High';
  document.getElementById('modal-type').value         = 'Positive';
  document.getElementById('modal-status').value       = 'Pending';
  clearModalErrors();
  showModal();
}

function showModal() {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-title-input').focus();
}

function hideModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  state.editingId = null;
}

/** Validate the modal form; returns true if valid */
function validateModalForm() {
  let valid = true;

  const titleVal = document.getElementById('modal-title-input').value.trim();
  const stepsVal = document.getElementById('modal-steps').value.trim();
  const expVal   = document.getElementById('modal-expected').value.trim();

  toggleError('merr-title',    !titleVal);
  toggleError('merr-steps',    !stepsVal);
  toggleError('merr-expected', !expVal);

  if (!titleVal || !stepsVal || !expVal) valid = false;
  return valid;
}

/** Open the delete confirmation modal */
function openDeleteModal(id) {
  state.deletingId = id;
  document.getElementById('delete-modal').classList.remove('hidden');
  document.getElementById('delete-confirm').focus();
}

function hideDeleteModal() {
  document.getElementById('delete-modal').classList.add('hidden');
  state.deletingId = null;
}

/* ===================================================================
   8. EXPORT (CSV & JSON)
   =================================================================== */

/**
 * Trigger a file download in the user's browser.
 * @param {string} content   - File content
 * @param {string} filename  - Download file name
 * @param {string} mimeType  - MIME type
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export all current test cases as a CSV file */
function exportCSV() {
  if (state.testCases.length === 0) {
    showToast('No test cases to export.');
    return;
  }
  const headers = ['ID', 'Title', 'Precondition', 'Test Steps', 'Expected Result', 'Priority', 'Type', 'Status', 'Feature'];
  const rows = state.testCases.map(tc => [
    tc.id,
    tc.title,
    tc.precondition,
    tc.steps.replace(/\n/g, ' | '),
    tc.expected.replace(/\n/g, ' | '),
    tc.priority,
    tc.type,
    tc.status,
    tc.feature,
  ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));

  const csv = [headers.join(','), ...rows].join('\r\n');
  downloadFile(csv, 'test_cases.csv', 'text/csv;charset=utf-8;');
  showToast('Exported as CSV ✓');
}

/** Export all current test cases as a JSON file */
function exportJSON() {
  if (state.testCases.length === 0) {
    showToast('No test cases to export.');
    return;
  }
  const json = JSON.stringify(state.testCases, null, 2);
  downloadFile(json, 'test_cases.json', 'application/json');
  showToast('Exported as JSON ✓');
}

/* ===================================================================
   9. TOAST NOTIFICATION
   =================================================================== */

let toastTimer = null;

/**
 * Show a brief toast message at the bottom-right of the screen.
 * @param {string} message
 * @param {number} duration - Milliseconds to show (default 2500)
 */
function showToast(message, duration = 2500) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = message;
  toast.classList.add('show');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

/* ===================================================================
   HELPERS
   =================================================================== */

/**
 * Toggle the visible state of an error message element.
 * @param {string}  id      - Element ID
 * @param {boolean} visible - Whether to show the error
 */
function toggleError(id, visible) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('hidden', !visible);
  el.classList.toggle('visible', visible);
}

/** Clear all modal validation errors */
function clearModalErrors() {
  ['merr-title', 'merr-steps', 'merr-expected'].forEach(id => toggleError(id, false));
}

/* ===================================================================
   10. EVENT LISTENERS & INIT
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ----- Load & render initial data -----
  loadFromStorage();
  renderList();

  // ----- Generator form submit -----
  document.getElementById('generator-form').addEventListener('submit', e => {
    e.preventDefault();

    const featureName = document.getElementById('feature-name').value.trim();
    const description = document.getElementById('feature-desc').value.trim();
    const checkedTypes = [
      ...document.querySelectorAll('input[name="test-type"]:checked'),
    ].map(cb => cb.value);

    // Validate generator form
    let valid = true;
    toggleError('err-feature-name', !featureName);
    toggleError('err-feature-desc', !description);
    toggleError('err-test-type',    checkedTypes.length === 0);
    if (!featureName || !description || checkedTypes.length === 0) valid = false;

    if (!valid) return;

    const count = generateTestCases(featureName, description, checkedTypes);
    renderList();
    showToast(`✓ Generated ${count} test case${count !== 1 ? 's' : ''}`);
    e.target.reset();
  });

  // ----- Reset generator form -----
  document.getElementById('btn-reset-form').addEventListener('click', () => {
    ['err-feature-name', 'err-feature-desc', 'err-test-type'].forEach(id => toggleError(id, false));
  });

  // ----- Add Manual button -----
  document.getElementById('btn-add-manual').addEventListener('click', openAddModal);

  // ----- Search input -----
  document.getElementById('search-input').addEventListener('input', e => {
    state.searchQuery = e.target.value;
    renderList();
  });

  // ----- Filter selects -----
  document.getElementById('filter-type').addEventListener('change', e => {
    state.filterType = e.target.value;
    renderList();
  });
  document.getElementById('filter-priority').addEventListener('change', e => {
    state.filterPriority = e.target.value;
    renderList();
  });
  document.getElementById('filter-status').addEventListener('change', e => {
    state.filterStatus = e.target.value;
    renderList();
  });

  // ----- Clear filters -----
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    state.filterType     = '';
    state.filterPriority = '';
    state.filterStatus   = '';
    state.searchQuery    = '';
    document.getElementById('filter-type').value     = '';
    document.getElementById('filter-priority').value = '';
    document.getElementById('filter-status').value   = '';
    document.getElementById('search-input').value    = '';
    renderList();
    showToast('Filters cleared');
  });

  // ----- Export buttons -----
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  document.getElementById('btn-export-json').addEventListener('click', exportJSON);

  // ----- Modal form submit (Add / Edit) -----
  document.getElementById('modal-form').addEventListener('submit', e => {
    e.preventDefault();
    if (!validateModalForm()) return;

    const data = {
      title:       document.getElementById('modal-title-input').value,
      precondition: document.getElementById('modal-precondition').value,
      steps:       document.getElementById('modal-steps').value,
      expected:    document.getElementById('modal-expected').value,
      priority:    document.getElementById('modal-priority').value,
      type:        document.getElementById('modal-type').value,
      status:      document.getElementById('modal-status').value,
    };

    if (state.editingId) {
      updateTestCase(state.editingId, data);
      showToast(`Test case ${state.editingId} updated ✓`);
    } else {
      const tc = addTestCase(data);
      showToast(`Test case ${tc.id} added ✓`);
    }

    hideModal();
    renderList();
  });

  // ----- Modal close / cancel -----
  document.getElementById('modal-close').addEventListener('click', hideModal);
  document.getElementById('modal-cancel').addEventListener('click', hideModal);

  // ----- Close modal on overlay click -----
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) hideModal();
  });

  // ----- Delete confirm -----
  document.getElementById('delete-confirm').addEventListener('click', () => {
    if (!state.deletingId) return;
    const id = state.deletingId;
    deleteTestCase(id);
    hideDeleteModal();
    renderList();
    showToast(`Test case ${id} deleted`);
  });

  // ----- Delete cancel -----
  document.getElementById('delete-cancel').addEventListener('click', hideDeleteModal);

  // ----- Close delete modal on overlay click -----
  document.getElementById('delete-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('delete-modal')) hideDeleteModal();
  });

  // ----- Close modals on Escape key -----
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      hideModal();
      hideDeleteModal();
    }
  });
});
