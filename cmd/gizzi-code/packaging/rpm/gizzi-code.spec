Name:           gizzi-code
Version:        1.0.0
Release:        1%{?dist}
Summary:        AI-powered terminal interface for the Allternit ecosystem

License:        MIT
URL:            https://gizzi.sh
Source0:        https://github.com/Gizziio/gizzi-code/archive/v%{version}.tar.gz

%description
Gizzi Code is an AI-powered terminal interface and runtime
for the Allternit ecosystem, providing intelligent code assistance
and terminal automation.

%prep
%autosetup

%build
# Binary is pre-built

%install
mkdir -p %{buildroot}/usr/local/bin
install -m 755 gizzi-code %{buildroot}/usr/local/bin/gizzi-code

%files
/usr/local/bin/gizzi-code

%changelog
* Mon Apr 07 2025 Allternit Technologies <team@allternit.io> - 1.0.0-1
- Initial release
