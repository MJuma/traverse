import { bootstrapExplorer } from '@mhjuma/traverse';

bootstrapExplorer({
    msalClientId: 'c8dbda70-81cc-49e0-aa47-6133d7154fe3',
    tenantId: '72f988bf-86f1-41af-91ab-2d7cd011db47',
    redirectUri: 'http://localhost:3000',
    clusterUrl: 'https://help.kusto.windows.net',
    database: 'Samples',
});
