// Login page functionality
document.addEventListener('DOMContentLoaded', function() {
  console.log('Login page loaded');
  
  const loginForm = document.getElementById('loginForm');
  const loginStatus = document.getElementById('loginStatus');
  
  console.log('Login form found:', !!loginForm);
  console.log('Login status found:', !!loginStatus);
  
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      console.log('Login form submitted');
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const remember = document.getElementById('remember').checked;
      
      // Basic validation
      if (!email || !password) {
        showStatus('Please fill in all required fields.', 'error');
        return;
      }
      
      // Backend login
      showStatus('Signing you in...', 'loading');
      console.log('Attempting login with email:', email);
      
      if (!window.api) {
        showStatus('API not available. Please refresh the page.', 'error');
        return;
      }
      
      window.api.login(email, password)
        .then((res) => {
          console.log('Login successful:', res);
          showStatus('Login successful! Redirecting to dashboard...', 'success');
          // Set all necessary localStorage items for authentication
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userEmail', email);
          localStorage.setItem('rememberMe', remember);
          if (res.user) {
            localStorage.setItem('userName', res.user.username || res.user.email);
            localStorage.setItem('userType', res.user.user_type || 'individual');
          }
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 800);
        })
        .catch((err) => {
          console.error('Login failed:', err);
          showStatus('Login failed: ' + err.message, 'error');
        });
    });
  } else {
    console.error('Login form not found!');
  }
  
  // Check if user is already logged in (using both localStorage and API token)
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  const hasApi = window.api && window.api.isAuthenticated();
  console.log('Auth check - isLoggedIn:', isLoggedIn, 'hasApi:', hasApi);
  
  if (isLoggedIn === 'true' && hasApi) {
    console.log('User already logged in, redirecting to dashboard');
    window.location.href = 'dashboard.html';
  }
});

function showStatus(message, type) {
  const statusElement = document.getElementById('loginStatus');
  if (!statusElement) return;
  
  statusElement.textContent = message;
  statusElement.className = 'status-message';
  
  switch (type) {
    case 'success':
      statusElement.style.color = '#10b981';
      break;
    case 'error':
      statusElement.style.color = '#ef4444';
      break;
    case 'loading':
      statusElement.style.color = '#6b7280';
      break;
    default:
      statusElement.style.color = '#6b7280';
  }
}
