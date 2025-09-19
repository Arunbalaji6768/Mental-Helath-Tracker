// Signup page functionality
document.addEventListener('DOMContentLoaded', function() {
  console.log('Signup page loaded');
  
  const signupForm = document.getElementById('signupForm');
  const signupStatus = document.getElementById('signupStatus');
  
  console.log('Signup form found:', !!signupForm);
  console.log('Signup status found:', !!signupStatus);
  
  if (signupForm) {
    signupForm.addEventListener('submit', function(e) {
      e.preventDefault();
      console.log('Signup form submitted');
      
      const firstName = document.getElementById('firstName').value;
      const lastName = document.getElementById('lastName').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const userType = document.getElementById('userType').value;
      const terms = document.getElementById('terms').checked;
      
      // Basic validation
      if (!firstName || !lastName || !email || !password || !userType || !terms) {
        showStatus('Please fill in all required fields and accept the terms.', 'error');
        return;
      }
      
      // Password validation
      if (password.length < 8) {
        showStatus('Password must be at least 8 characters long.', 'error');
        return;
      }
      
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showStatus('Please enter a valid email address.', 'error');
        return;
      }
      
      // Backend signup
      showStatus('Creating your account...', 'loading');
      console.log('Attempting signup with email:', email);
      
      if (!window.api) {
        showStatus('API not available. Please refresh the page.', 'error');
        return;
      }
      
      // Create username from first and last name
      const username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;
      
      window.api.signup({ username, email, password })
        .then((res) => {
          console.log('Signup successful:', res);
          showStatus('Account created successfully! Redirecting to dashboard...', 'success');
          
          // Store user data for immediate login
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userEmail', email);
          localStorage.setItem('userName', `${firstName} ${lastName}`);
          localStorage.setItem('userType', userType);
          localStorage.setItem('rememberMe', 'true');
          
          // Set auth token if provided
          if (res.token && window.api) {
            window.api.setToken(res.token);
          }
          
          // Original behavior: redirect to appropriate dashboard after short delay
          setTimeout(() => {
            if (userType === 'therapist') {
              window.location.href = 'therapist-dashboard.html';
            } else {
              window.location.href = 'dashboard.html';
            }
          }, 1500);
        })
        .catch((err) => {
          console.error('Signup failed:', err);
          showStatus('Signup failed: ' + err.message, 'error');
        });
    });
  } else {
    console.error('Signup form not found!');
  }
  
  // Original behavior: if already logged in, redirect to dashboard
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  const hasApi = window.api && window.api.isAuthenticated();
  console.log('Auth check - isLoggedIn:', isLoggedIn, 'hasApi:', hasApi);
  if (isLoggedIn === 'true' && hasApi) {
    console.log('User already logged in, redirecting to dashboard');
    window.location.href = 'dashboard.html';
  }
});

function showStatus(message, type) {
  const statusElement = document.getElementById('signupStatus');
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
