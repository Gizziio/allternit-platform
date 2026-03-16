# Contributing to Gizzi Thin Client

Thank you for your interest in contributing to the Gizzi Thin Client! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Testing](#testing)

## Code of Conduct

This project and everyone participating in it is governed by our commitment to:

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Respect different viewpoints and experiences

## Getting Started

### Prerequisites

- Node.js 18.x LTS
- npm 9.x+
- Git

### Setup

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/thin-client.git
cd thin-client

# Install dependencies
npm install

# Start development
npm run dev
```

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

Example: `feature/add-keyboard-shortcuts`

### Commit Messages

Follow conventional commits:

```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/config changes

Examples:
```
feat(chat): add message search functionality

fix(connection): handle timeout errors gracefully

docs(readme): update installation instructions
```

## Submitting Changes

### Pull Request Process

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make your changes** following our coding standards

3. **Test your changes**:
   ```bash
   npm run typecheck
   npm run lint
   ```

4. **Commit with clear messages**:
   ```bash
   git commit -m "feat: add new feature"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature
   ```

6. **Create a Pull Request** on GitHub

### PR Requirements

- [ ] Description explains what and why
- [ ] Screenshots/GIFs for UI changes
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No merge conflicts
- [ ] Follows coding standards

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactoring

## Testing
How was this tested?

## Screenshots (if applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
```

## Coding Standards

### TypeScript

```typescript
// Use explicit types
function greet(name: string): string {
  return `Hello, ${name}`;
}

// Use interfaces for objects
interface User {
  id: string;
  name: string;
  email?: string;
}

// Avoid `any`
// ❌ Bad
function process(data: any): any

// ✅ Good
function process<T>(data: T): Processed<T>
```

### React Components

```typescript
// Use functional components
interface Props {
  title: string;
  onClick?: () => void;
}

export const Button: React.FC<Props> = ({ title, onClick }) => {
  return (
    <button onClick={onClick}>
      {title}
    </button>
  );
};

// Use hooks properly
export const useData = () => {
  const [data, setData] = useState<Data | null>(null);
  
  useEffect(() => {
    fetchData().then(setData);
  }, []);
  
  return data;
};
```

### CSS/Styling

```typescript
// Use CSS-in-JS for component styles
const styles = {
  container: {
    display: 'flex',
    padding: 'var(--spacing-md)',
  },
};

// Or use Tailwind classes
<div className="flex items-center gap-2 p-3" />
```

### File Organization

```
src/
├── components/     # React components
│   ├── common/     # Shared components
│   └── features/   # Feature-specific
├── hooks/          # Custom React hooks
├── stores/         # Zustand stores
├── lib/            # Utilities
├── types/          # TypeScript types
└── styles/         # Global styles
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Writing Tests

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button title="Click me" />);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
  
  it('handles click events', () => {
    const onClick = jest.fn();
    render(<Button title="Click" onClick={onClick} />);
    fireEvent.click(screen.getByText('Click'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

## Documentation

- Update README.md for user-facing changes
- Update docs/ for technical changes
- Add JSDoc comments for public APIs
- Include examples in documentation

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create git tag: `git tag -a v0.1.0 -m "Release v0.1.0"`
4. Push tag: `git push origin v0.1.0`
5. GitHub Actions will build and release

## Questions?

- Open an issue for bugs
- Start a discussion for features
- Join our Discord for chat

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing! 🎉
