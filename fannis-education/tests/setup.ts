// Les tests d'intégration utilisent TEST_DATABASE_URL (base dédiée, vidée à chaque exécution).
process.env.AUTH_SECRET ||= "test-secret-test-secret-test-secret-0123456789";
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
