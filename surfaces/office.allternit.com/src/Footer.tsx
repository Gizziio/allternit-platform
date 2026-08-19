import { ALLTERNIT_PLATFORM_URL } from './platformUrl'

interface FooterLink {
  label: string
  href: string
  external?: boolean
}

interface FooterColumn {
  title: string
  links: FooterLink[]
}

const BASE = ALLTERNIT_PLATFORM_URL.replace(/\/$/, '')

const footerColumns: FooterColumn[] = [
  {
    title: 'Research',
    links: [
      { label: 'Research Home', href: `${BASE}/research` },
      { label: 'Allternit News', href: `${BASE}/news` },
      { label: 'A://SUDO Reality', href: `${BASE}/reality` },
      { label: 'Allternit Blog', href: `${BASE}/blog` },
      { label: 'Economic Futures', href: `${BASE}/economic-futures` },
      { label: "Gizzi's Constitution", href: `${BASE}/constitution` },
      { label: 'RSS Feed', href: `${BASE}/rss.xml`, external: true },
    ],
  },
  {
    title: 'Products',
    links: [
      { label: 'Platform', href: `${BASE}/platform` },
      { label: 'Gizzi Code', href: `${BASE}/gizzi-code` },
      { label: 'Gizzi Code Enterprise', href: `${BASE}/gizzi-code-enterprise` },
      { label: 'Chat', href: `${BASE}/chat` },
      { label: 'Cowork', href: `${BASE}/cowork` },
      { label: 'A:// Web', href: `${BASE}/web` },
      { label: 'Pricing', href: `${BASE}/pricing` },
    ],
  },
  {
    title: 'A://Labs',
    links: [
      { label: 'Labs Home', href: `${BASE}/a-labs` },
      { label: 'Courses', href: 'https://labs.allternit.com', external: true },
      { label: 'Learning Paths', href: `${BASE}/learn` },
      { label: 'Documentation', href: 'https://docs.allternit.com', external: true },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Documentation', href: 'https://docs.allternit.com', external: true },
      { label: 'API Reference', href: 'https://docs.allternit.com/api', external: true },
      { label: 'TypeScript SDK', href: 'https://docs.allternit.com/sdk', external: true },
      { label: 'Service Catalog', href: 'https://docs.allternit.com/services', external: true },
      { label: 'Console login', href: 'https://platform.allternit.com/sign-in', external: true },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Allternit', href: `${BASE}/company` },
      { label: 'Allternit Services', href: 'https://services.allternit.com', external: true },
      { label: 'Careers', href: `${BASE}/careers` },
      { label: 'News', href: `${BASE}/news` },
      { label: 'Blog', href: `${BASE}/blog` },
      { label: 'Customer stories', href: `${BASE}/stories` },
      { label: 'Models', href: `${BASE}/models` },
      { label: 'Solutions', href: `${BASE}/solutions` },
    ],
  },
]

const legalLinks: FooterLink[] = [
  { label: 'Privacy policy', href: `${BASE}/privacy` },
  { label: 'Terms of service', href: `${BASE}/terms` },
]

function FooterLinkItem({ link }: { link: FooterLink }) {
  const className = 'office-footer__link'
  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {link.label}
      </a>
    )
  }
  return (
    <a href={link.href} className={className}>
      {link.label}
    </a>
  )
}

export function Footer() {
  return (
    <footer className="office-footer">
      <div className="office-footer__top-line" aria-hidden="true" />

      <div className="office-footer__inner">
        <div className="office-footer__grid">
          {footerColumns.map((column) => (
            <div key={column.title} className="office-footer__column">
              <h3 className="office-footer__column-title">{column.title}</h3>
              <ul className="office-footer__list">
                {column.links.map((link) => (
                  <li key={link.label} className="office-footer__item">
                    <FooterLinkItem link={link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="office-footer__bottom">
          <p className="office-footer__copyright">© 2026 Allternit PBC</p>
          <div className="office-footer__legal">
            {legalLinks.map((link) => (
              <a key={link.label} href={link.href} className="office-footer__link">
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
