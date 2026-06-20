
(function() {
  if (typeof Sentry === 'undefined') return;
  var _p = [
    'aHR0cHM6Ly9jNzg0YjZjODI1ZThkNTI2',
    'YzY4MmE0M2YzOWI2OWYyOUBvNDUxMTU5',
    'NTYzNTQwODg5Ni5pbmdlc3QuZGUuc2Vu',
    'dHJ5LmlvLzQ1MTE1OTU2NDUwNDI3Njg='
  ];
  try {
    Sentry.init({
      dsn: atob(_p.join('')),
      sampleRate: 0.5,
      maxBreadcrumbs: 10,
      autoSessionTracking: false,
      sendDefaultPii: false,
      beforeBreadcrumb: function(breadcrumb) {
        if (breadcrumb.category === 'ui.input') return null;
        if (breadcrumb.category === 'ui.click') {
          delete breadcrumb.message;
          delete breadcrumb.data;
        }
        return breadcrumb;
      },
      beforeSend: function(event) {
        event.tags = event.tags || {};
        event.tags.source = 'minishield';
        delete event.user;
        delete event.server_name;
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers;
          delete event.request.data;
        }
        return event;
      }
    });
  } catch(_) {}
})();
