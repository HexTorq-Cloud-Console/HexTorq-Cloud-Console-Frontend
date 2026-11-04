import type { AccessForm } from '../types/api';

// Default form state.
function emptyAccessForm(): AccessForm {
  return {
    clientId: '',
    type: 'SFTP',
    label: '',
    host: '',
    port: 22,
    username: '',
    password: '',
    path: '',
    databaseName: '',
    sslMode: 'Prefer',
    notes: '',
    enabled: true,
  };
}
export { emptyAccessForm };
