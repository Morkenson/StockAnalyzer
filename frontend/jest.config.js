module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/**/*.spec.ts'],
  collectCoverageFrom: [
    'app/app.component.ts',
    'app/guards/**/*.ts',
    'app/services/auth.service.ts',
    'app/services/auth.interceptor.ts',
    'app/services/global-error-handler.service.ts',
    '!app/**/*.module.ts',
    '!app/app-routing.module.ts',
    '!app/models/**/*.ts'
  ],
  coverageDirectory: '../coverage/frontend',
  coverageReporters: ['text', 'html', 'json-summary'],
  moduleFileExtensions: ['ts', 'html', 'js', 'json']
};
