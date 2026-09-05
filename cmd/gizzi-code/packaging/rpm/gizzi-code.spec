Name:           gizzi-code
Version:        2.0.2
Release:        1%{?dist}
Summary:        AI-powered terminal interface for the Allternit ecosystem

License:        MIT
URL:            https://docs.gizziio.com
# Binary release asset (version-named tarball, tag gizzi-code/v%{version})
Source0:        https://github.com/Gizziio/allternit-platform/releases/download/gizzi-code/v%{version}/gizzi-code-v%{version}-linux-x64.tar.gz

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
* Fri Sep 05 2026 Allternit Technologies <team@allternit.io> - 2.0.2-1
- Update to 2.0.2; GitHub Release assets at gizzi-code/v%{version}

* Wed Sep 03 2026 Allternit Technologies <team@allternit.io> - 1.0.2-1
- Update to 1.0.2; point Source0 at the version-named binary release asset

* Mon Apr 07 2025 Allternit Technologies <team@allternit.io> - 1.0.0-1
- Initial release
