/**
 * Cloud Provider Registry
 * 
 * Dynamic provider data with real links and API integration.
 */

export interface Provider {
  id: string;
  name: string;
  logo: string;
  website: string;
  signupUrl: string;
  apiDocsUrl: string;
  apiConsoleUrl?: string;
  startingPrice: number;
  currency: string;
  regions: Region[];
  instanceTypes: InstanceType[];
  credentialFields: CredentialField[];
  features: string[];
  bestFor: string;
  setupTime: string;
}

export interface Region {
  id: string;
  name: string;
  location: string;
  flag: string;
}

export interface InstanceType {
  id: string;
  name: string;
  vcpus: number;
  memoryGb: number;
  storageGb: number;
  priceMonthly: number;
  recommended?: boolean;
}

export interface CredentialField {
  name: string;
  type: 'text' | 'password';
  helpUrl: string;
  placeholder: string;
}

// Provider data - would be fetched from backend API in production
export const PROVIDERS: Provider[] = [
  {
    id: 'hetzner',
    name: 'Hetzner Cloud',
    logo: '🟢',
    website: 'https://www.hetzner.com/cloud',
    signupUrl: 'https://accounts.hetzner.com/register',
    apiDocsUrl: 'https://docs.hetzner.cloud/',
    apiConsoleUrl: 'https://console.hetzner.cloud/',
    startingPrice: 4.51,
    currency: 'EUR',
    regions: [
      { id: 'fsn1', name: 'Falkenstein', location: 'Germany', flag: '🇩🇪' },
      { id: 'nbg1', name: 'Nuremberg', location: 'Germany', flag: '🇩🇪' },
      { id: 'hel1', name: 'Helsinki', location: 'Finland', flag: '🇫🇮' },
      { id: 'ash', name: 'Ashburn', location: 'United States', flag: '🇺🇸' },
    ],
    instanceTypes: [
      { id: 'cx11', name: 'CX11', vcpus: 1, memoryGb: 2, storageGb: 20, priceMonthly: 4.51 },
      { id: 'cx21', name: 'CX21', vcpus: 2, memoryGb: 4, storageGb: 40, priceMonthly: 9.01, recommended: true },
      { id: 'cx31', name: 'CX31', vcpus: 2, memoryGb: 8, storageGb: 80, priceMonthly: 15.81 },
      { id: 'cx41', name: 'CX41', vcpus: 4, memoryGb: 16, storageGb: 160, priceMonthly: 31.61 },
    ],
    credentialFields: [
      { name: 'API Token', type: 'password', helpUrl: 'https://docs.hetzner.cloud/#authentication', placeholder: 'Enter your API token' },
    ],
    features: ['Unlimited traffic', 'NVMe SSD', 'EU locations', '99.9% SLA'],
    bestFor: 'Budget EU deployments',
    setupTime: '2-3 minutes',
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    logo: '🔷',
    website: 'https://www.digitalocean.com/products/droplets',
    signupUrl: 'https://cloud.digitalocean.com/registrations/new',
    apiDocsUrl: 'https://docs.digitalocean.com/reference/api/',
    apiConsoleUrl: 'https://cloud.digitalocean.com/account/api/tokens',
    startingPrice: 6.00,
    currency: 'USD',
    regions: [
      { id: 'nyc1', name: 'New York 1', location: 'United States', flag: '🇺🇸' },
      { id: 'nyc3', name: 'New York 3', location: 'United States', flag: '🇺🇸' },
      { id: 'sfo3', name: 'San Francisco', location: 'United States', flag: '🇺🇸' },
      { id: 'ams3', name: 'Amsterdam', location: 'Netherlands', flag: '🇳🇱' },
      { id: 'sgp1', name: 'Singapore', location: 'Singapore', flag: '🇸🇬' },
      { id: 'lon1', name: 'London', location: 'United Kingdom', flag: '🇬🇧' },
      { id: 'fra1', name: 'Frankfurt', location: 'Germany', flag: '🇩🇪' },
      { id: 'tor1', name: 'Toronto', location: 'Canada', flag: '🇨🇦' },
      { id: 'blr1', name: 'Bangalore', location: 'India', flag: '🇮🇳' },
    ],
    instanceTypes: [
      { id: 's-1vcpu-1gb', name: 'Basic', vcpus: 1, memoryGb: 1, storageGb: 25, priceMonthly: 6.00 },
      { id: 's-1vcpu-2gb', name: 'Basic', vcpus: 1, memoryGb: 2, storageGb: 50, priceMonthly: 12.00, recommended: true },
      { id: 's-2vcpu-2gb', name: 'Basic', vcpus: 2, memoryGb: 2, storageGb: 60, priceMonthly: 18.00 },
      { id: 's-2vcpu-4gb', name: 'Basic', vcpus: 2, memoryGb: 4, storageGb: 80, priceMonthly: 24.00 },
    ],
    credentialFields: [
      { name: 'Access Token', type: 'password', helpUrl: 'https://docs.digitalocean.com/reference/api/create-personal-access-token/', placeholder: 'Enter your access token' },
    ],
    features: ['1TB transfer', 'Great docs', 'Easy to use', 'Community tutorials'],
    bestFor: 'Developer friendly',
    setupTime: '3-4 minutes',
  },
  {
    id: 'contabo',
    name: 'Contabo',
    logo: '🔵',
    website: 'https://contabo.com/cloud-vps/',
    signupUrl: 'https://contabo.com/register/',
    apiDocsUrl: 'https://docs.contabo.com/',
    startingPrice: 5.50,
    currency: 'EUR',
    regions: [
      { id: 'de', name: 'Germany', location: 'Germany', flag: '🇩🇪' },
      { id: 'us', name: 'United States', location: 'United States', flag: '🇺🇸' },
      { id: 'sg', name: 'Singapore', location: 'Singapore', flag: '🇸🇬' },
    ],
    instanceTypes: [
      { id: 'vps-10', name: 'VPS 10', vcpus: 4, memoryGb: 8, storageGb: 50, priceMonthly: 5.50, recommended: true },
      { id: 'vps-20', name: 'VPS 20', vcpus: 6, memoryGb: 16, storageGb: 100, priceMonthly: 10.50 },
      { id: 'vps-30', name: 'VPS 30', vcpus: 8, memoryGb: 30, storageGb: 200, priceMonthly: 16.50 },
      { id: 'vps-40', name: 'VPS 40', vcpus: 10, memoryGb: 48, storageGb: 400, priceMonthly: 23.50 },
    ],
    credentialFields: [
      { name: 'Client ID', type: 'text', helpUrl: 'https://docs.contabo.com/', placeholder: 'Enter your Client ID' },
      { name: 'API Password', type: 'password', helpUrl: 'https://docs.contabo.com/', placeholder: 'Enter your API password' },
    ],
    features: ['Up to 48GB RAM', 'Cheap storage', 'Global locations', 'No bandwidth limits'],
    bestFor: 'High RAM, low cost',
    setupTime: '3-5 minutes',
  },
  {
    id: 'racknerd',
    name: 'RackNerd',
    logo: '🔴',
    website: 'https://www.racknerd.com/',
    signupUrl: 'https://my.racknerd.com/',
    apiDocsUrl: 'https://my.racknerd.com/knowledgebase/',
    startingPrice: 10.98,
    currency: 'USD',
    regions: [
      { id: 'us', name: 'United States', location: 'United States', flag: '🇺🇸' },
      { id: 'eu', name: 'Europe', location: 'Netherlands', flag: '🇳🇱' },
    ],
    instanceTypes: [
      { id: 'budget-1', name: 'Budget 1', vcpus: 1, memoryGb: 1, storageGb: 20, priceMonthly: 10.98 },
      { id: 'budget-2', name: 'Budget 2', vcpus: 2, memoryGb: 2, storageGb: 35, priceMonthly: 15.98, recommended: true },
      { id: 'budget-3', name: 'Budget 3', vcpus: 3, memoryGb: 3, storageGb: 50, priceMonthly: 20.98 },
    ],
    credentialFields: [
      { name: 'API Key', type: 'text', helpUrl: 'https://my.racknerd.com/', placeholder: 'Enter your API key' },
      { name: 'API Secret', type: 'password', helpUrl: 'https://my.racknerd.com/', placeholder: 'Enter your API secret' },
    ],
    features: ['US locations', 'DDoS protection', 'Good support', 'Instant setup'],
    bestFor: 'Budget US deployments',
    setupTime: '2-4 minutes',
  },
  {
    id: 'aws',
    name: 'Amazon Web Services',
    logo: '🟠',
    website: 'https://aws.amazon.com/ec2/',
    signupUrl: 'https://portal.aws.amazon.com/billing/signup',
    apiDocsUrl: 'https://docs.aws.amazon.com/ec2/',
    apiConsoleUrl: 'https://console.aws.amazon.com/ec2/',
    startingPrice: 7.59,
    currency: 'USD',
    regions: [
      { id: 'us-east-1', name: 'US East (N. Virginia)', location: 'United States', flag: '🇺🇸' },
      { id: 'us-west-2', name: 'US West (Oregon)', location: 'United States', flag: '🇺🇸' },
      { id: 'eu-west-1', name: 'EU (Ireland)', location: 'Ireland', flag: '🇮🇪' },
      { id: 'eu-central-1', name: 'EU (Frankfurt)', location: 'Germany', flag: '🇩🇪' },
      { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', location: 'Singapore', flag: '🇸🇬' },
      { id: 'ap-southeast-2', name: 'Asia Pacific (Sydney)', location: 'Australia', flag: '🇦🇺' },
      { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', location: 'Japan', flag: '🇯🇵' },
    ],
    instanceTypes: [
      { id: 't3-micro', name: 't3.micro', vcpus: 2, memoryGb: 1, storageGb: 0, priceMonthly: 7.59 },
      { id: 't3-small', name: 't3.small', vcpus: 2, memoryGb: 2, storageGb: 0, priceMonthly: 15.18, recommended: true },
      { id: 't3-medium', name: 't3.medium', vcpus: 2, memoryGb: 4, storageGb: 0, priceMonthly: 30.37 },
      { id: 't3-large', name: 't3.large', vcpus: 2, memoryGb: 8, storageGb: 0, priceMonthly: 60.74 },
    ],
    credentialFields: [
      { name: 'Access Key ID', type: 'text', helpUrl: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html', placeholder: 'AKIA...' },
      { name: 'Secret Access Key', type: 'password', helpUrl: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html', placeholder: 'Enter your secret access key' },
    ],
    features: ['Most reliable', 'Global scale', 'Full ecosystem', 'Enterprise ready'],
    bestFor: 'Enterprise features',
    setupTime: '5-7 minutes',
  },
];

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find(p => p.id === id);
}

export function getProviderRegion(providerId: string, regionId: string): Region | undefined {
  const provider = getProvider(providerId);
  return provider?.regions.find(r => r.id === regionId);
}

export function getProviderInstance(providerId: string, instanceId: string): InstanceType | undefined {
  const provider = getProvider(providerId);
  return provider?.instanceTypes.find(i => i.id === instanceId);
}
