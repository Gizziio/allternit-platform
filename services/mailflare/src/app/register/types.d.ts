export type SetupStatus = {
	hasAdminAccount: boolean;
	hasPrimaryDomain: boolean;
	primaryDomain?: { hostname: string } | null;
};

export type DomainSetupResult = {
	domain?: { hostname: string };
	error?: string;
};

export type RegisterResult = {
	token?: string;
	redirect?: string;
	error?: string;
};
