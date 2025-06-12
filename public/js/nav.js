// Navigation script for Weekday Warriors
document.addEventListener('DOMContentLoaded', () => {
    // Add active class to current page's nav link
    const currentPage = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        
        // Check if the current page matches the link's href
        // or if we're on the homepage and the link is to the homepage
        if (currentPage === linkPath || 
            (currentPage === '/' && linkPath === '/') ||
            (currentPage.includes(linkPath) && linkPath !== '/')) {
            link.style.fontWeight = '900';
            link.style.textShadow = '0 0 8px rgba(255, 255, 255, 0.4)';
        }
    });
});

// Prevent double click zoom in
document.addEventListener('touchstart', function(event) {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
}, { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', function(event) {
  const now = (new Date()).getTime();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, false);