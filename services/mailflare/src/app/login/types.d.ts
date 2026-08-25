export type LoginResult = {
	token?: string;
	redirect?: string;
	error?: string;
};

export type RegistrationStatus = {
	hasAdminAccount: boolean;
};
