// ====== MOBILE MENU / SIDEBAR TOGGLE ======
$('#sidebarToggle').addEventListener('click', () => {
  sidebarCollapsed = !sidebarCollapsed;
  localStorage.setItem('crm_sidebarCollapsed', sidebarCollapsed);
  $('#appShell').classList.toggle('sidebar-collapsed', sidebarCollapsed);
});
$('#mobileMenuBtn')?.addEventListener('click', () => {
  $('#appSidebar').classList.toggle('mobile-open');
  $('#sidebarOverlay').classList.toggle('hidden', !$('#appSidebar').classList.contains('mobile-open'));
});
$('#sidebarOverlay')?.addEventListener('click', () => {
  $('#appSidebar').classList.remove('mobile-open');
  $('#sidebarOverlay').classList.add('hidden');
});