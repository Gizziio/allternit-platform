export type ImportMessagesResult = {
	imported?: number;
	skipped?: number;
	errors?: string[];
	error?: string;
};

export type ImportMessagesProps = {
	destination: string;
	sourceLabel: string;
};
