# 🤝 Contributing to Whispey

Thank you for your interest in contributing to Whispey! We welcome contributions from the community and appreciate your help in making Whispey better for everyone.

## 🎯 How to Contribute

There are many ways to contribute to Whispey:

- **🐛 Bug Reports** - Help us identify and fix issues
- **💡 Feature Requests** - Suggest new features and improvements
- **📝 Documentation** - Improve our guides and tutorials
- **🔧 Code Contributions** - Submit pull requests with code changes
- **💬 Community Support** - Help other users in Discord and GitHub
- **⭐ Star the Repository** - Show your support

## 🚀 Quick Start

### 1. Fork the Repository

```bash
# Fork on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/whispey.git
cd whispey

# Add the original repository as upstream
git remote add upstream https://github.com/PYPE-AI-MAIN/whispey.git
```

### 2. Set Up Development Environment

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local

# Start development server
npm run dev
```

### 3. Create a Feature Branch

```bash
# Create and switch to a new branch
git checkout -b feature/amazing-feature

# Make your changes
# ... edit files ...

# Commit your changes
git commit -m "Add amazing feature"

# Push to your fork
git push origin feature/amazing-feature
```

### 4. Submit a Pull Request

1. **Go to your fork** on GitHub
2. **Click "New Pull Request"**
3. **Select your feature branch**
4. **Write a clear description** of your changes
5. **Submit the PR**

## 📋 Development Guidelines

### Code Style

We follow these coding standards:

#### Python (SDK)
```python
# Use PEP 8 style guide
# Use type hints
# Add docstrings for functions
# Keep functions under 50 lines

def process_call_data(call_id: str, metadata: dict) -> dict:
    """Process call data and return analytics.
    
    Args:
        call_id: The unique call identifier
        metadata: Additional call metadata
        
    Returns:
        Processed analytics data
    """
    # Implementation here
    pass
```

#### TypeScript/JavaScript (Dashboard)
```typescript
// Use TypeScript for type safety
// Follow ESLint rules
// Use meaningful variable names
// Add JSDoc comments

/**
 * Process analytics data for display
 * @param data - Raw analytics data
 * @returns Processed analytics for UI
 */
function processAnalytics(data: AnalyticsData): ProcessedAnalytics {
  // Implementation here
  return processedData;
}
```

### Commit Messages

Use conventional commit format:

```
type(scope): description

feat(dashboard): add cost comparison chart
fix(sdk): resolve session export timeout
docs(readme): update installation instructions
style(ui): improve button spacing
refactor(api): simplify webhook handling
test(sdk): add unit tests for export function
```

### Pull Request Guidelines

#### Before Submitting

- [ ] **Tests pass** - Run `npm test` and `python -m pytest`
- [ ] **Code is formatted** - Use Prettier and Black
- [ ] **Documentation updated** - Update relevant docs
- [ ] **No breaking changes** - Unless clearly documented

#### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] No breaking changes

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
```

## 🏗️ Project Structure

```
obsera/
├── src/                    # Next.js dashboard
│   ├── app/               # App router pages
│   ├── components/        # React components
│   ├── lib/              # Utility functions
│   └── types/            # TypeScript types
├── sdk/                   # Python SDK
│   ├── whispey/           # SDK source code
│   ├── tests/            # Unit tests
│   └── setup.py          # Package configuration
├── docs/                  # Documentation
├── public/               # Static assets
└── README.md             # Main documentation
```

## 🧪 Testing

### Running Tests

```bash
# Frontend tests
npm test

# SDK tests
cd sdk
python -m pytest

# Integration tests
npm run test:integration
```

### Writing Tests

#### Python SDK Tests
```python
import pytest
from whispey import LivekitObserve

def test_session_creation():
    """Test that sessions can be created successfully."""
    whispey = LivekitObserve(agent_id="test-agent")
    # Test implementation
    assert True

def test_export_functionality():
    """Test that data export works correctly."""
    # Test implementation
    pass
```

#### Frontend Tests
```typescript
import { render, screen } from '@testing-library/react'
import { Dashboard } from '../components/Dashboard'

test('renders dashboard with metrics', () => {
  render(<Dashboard />)
  expect(screen.getByText('Total Calls')).toBeInTheDocument()
})
```

## 📝 Documentation

### Documentation Standards

- **Clear and concise** - Write for developers
- **Include examples** - Show real usage
- **Keep updated** - Update when code changes
- **Use proper formatting** - Follow markdown guidelines

### Documentation Structure

```
docs/
├── getting-started.md     # Quick start guide
├── sdk-reference.md      # SDK documentation
├── dashboard-guide.md    # Dashboard tutorial
├── self-hosting.md       # Self-hosting guide
├── api-reference.md      # API documentation
├── faq.md               # Frequently asked questions
└── contributing.md       # This file
```

## 🐛 Bug Reports

### Before Reporting

1. **Search existing issues** - Check if it's already reported
2. **Reproduce the issue** - Ensure it's reproducible
3. **Check documentation** - Verify it's not user error
4. **Test with latest version** - Ensure it's not already fixed

### Bug Report Template

```markdown
## Bug Description
Clear description of the issue

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g., macOS 14.0]
- Node.js: [e.g., 18.17.0]
- Python: [e.g., 3.11.0]
- Whispey Version: [e.g., 1.2.0]

## Additional Information
Screenshots, logs, or other relevant information
```

## 💡 Feature Requests

### Before Requesting

1. **Check existing features** - Ensure it's not already available
2. **Search discussions** - Check if it's been discussed
3. **Consider alternatives** - Look for existing solutions
4. **Think about scope** - Consider implementation complexity

### Feature Request Template

```markdown
## Feature Description
Clear description of the requested feature

## Use Case
Why this feature is needed

## Proposed Solution
How you think it should work

## Alternatives Considered
Other approaches you've considered

## Additional Information
Mockups, examples, or other context
```

## 🏷️ Issue Labels

We use these labels to organize issues:

- **🐛 bug** - Something isn't working
- **💡 enhancement** - New feature or request
- **📝 documentation** - Improvements to docs
- **🔧 good first issue** - Good for newcomers
- **🏗️ help wanted** - Extra attention needed
- **🚨 high priority** - Urgent issues
- **🔒 security** - Security-related issues

## 🎉 Recognition

### Contributors Hall of Fame

We recognize contributors in several ways:

- **GitHub Contributors** - Listed on the main repository
- **Release Notes** - Credit in release announcements
- **Documentation** - Credit in relevant docs
- **Community Shoutouts** - Recognition in Discord

### Contribution Levels

- **🥉 Bronze** - 1-5 contributions
- **🥈 Silver** - 6-20 contributions  
- **🥇 Gold** - 21+ contributions
- **💎 Diamond** - Major contributions

## 🆘 Getting Help

### Development Questions

- **💬 Discord**: [Join our community](https://discord.gg/pypeai)
- **🐛 GitHub Issues**: Open an issue for technical questions
- **📧 Email**: dev-support@whispey.ai for private discussions

### Mentorship

New contributors can:

- **Ask for help** in Discord or GitHub
- **Request pairing** with experienced contributors
- **Get code reviews** from maintainers
- **Join office hours** for live help

## 📋 Code of Conduct

### Our Standards

- **Be respectful** - Treat everyone with respect
- **Be inclusive** - Welcome diverse perspectives
- **Be constructive** - Provide helpful feedback
- **Be collaborative** - Work together effectively

### Unacceptable Behavior

- **Harassment** - Any form of harassment
- **Discrimination** - Based on any protected characteristic
- **Trolling** - Deliberately disruptive behavior
- **Spam** - Unwanted promotional content

### Reporting

Report violations to:
- **📧 Email**: conduct@whispey.ai
- **💬 Discord**: Message moderators
- **🐛 GitHub**: Open private issue

## 📄 License

By contributing to Whispey, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You

Thank you for contributing to Whispey! Your contributions help make voice AI analytics better for everyone.

---

**Ready to contribute?** Start with a [good first issue](https://github.com/PYPE-AI-MAIN/whispey/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) or join our [Discord community](https://discord.gg/pypeai)! 