# Contributing to {{PLUGIN_NAME}}

Thank you for your interest in contributing! 🎉

## Getting Started

### Prerequisites

- Node.js 18+ or Bun 1.0+
- Git

### Development Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/{{GITHUB_USERNAME}}/{{REPO_NAME}}.git
   cd {{REPO_NAME}}
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the initialization script:
   ```bash
   npm run init
   ```

4. Start development mode:
   ```bash
   npm run dev
   ```

## Development Workflow

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/amazing-feature
   ```

2. Make your changes

3. Run tests and validation:
   ```bash
   npm run validate:full
   ```

4. Commit your changes:
   ```bash
   git commit -m "feat: add amazing feature"
   ```

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### Code Style

- **TypeScript**: Follow the existing code style
- **Formatting**: Run `npm run format` before committing
- **Linting**: Run `npm run lint` to check for issues

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Writing Tests

Place test files in `src/__tests__/` with the `.test.ts` extension:

```typescript
describe('My Feature', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

## Submitting Changes

### Pull Request Process

1. Update documentation for any changed functionality
2. Add tests for new features
3. Ensure all tests pass: `npm run validate:full`
4. Update CHANGELOG.md with your changes
5. Submit the pull request

### PR Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Code follows style guidelines
- [ ] No placeholder values remaining

## Reporting Issues

### Bug Reports

Include:
- Plugin version
- A2R Platform version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternatives considered

## Questions?

- Check the [documentation](./docs/README.md)
- Join our [Discord community](https://discord.gg/a2r)
- Open a [GitHub Discussion](https://github.com/{{GITHUB_USERNAME}}/{{REPO_NAME}}/discussions)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
