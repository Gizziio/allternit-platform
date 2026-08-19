import type { AuthShellProps } from "./types";

export function AuthShell({ icon: Icon, title, description, children, footer, steps }: AuthShellProps) {
	return (
		<div className="min-h-dvh bg-[#f6f8fc] p-4 text-neutral-900 sm:p-6">
			<div className="mx-auto flex min-h-[calc(100dvh-32px)] max-w-6xl items-center sm:min-h-[calc(100dvh-48px)]">
				<div className="mx-auto bg-white overflow-hidden rounded-4xl shadow-lg shadow-neutral-200/50">

					<section className="flex flex-col justify-between p-6 sm:p-10">
						<div>
							<div className="mb-8">
							
								<h1 className="max-w-sm text-4xl font-semibold leading-tight tracking-tight text-neutral-950">
									{title}
								</h1>
								{description && <p className="mt-4 max-w-md text-sm leading-6 text-neutral-600">{description}</p>}
							</div>
							{steps && (
								<div className="mb-8 flex gap-2 text-xs font-semibold">
									{steps.map((step, index) => (
										<span key={step.label} className="flex items-center gap-2">
											<span className={step.active ? "text-blue-700" : "text-neutral-400"}>
												{index + 1} {step.label}
											</span>
											{index < steps.length - 1 && <span className="text-neutral-300">/</span>}
										</span>
									))}
								</div>
							)}
							{children}
						</div>
						<div className="mt-8 text-sm font-medium text-blue-700">{footer}</div>
					</section>
				</div>
			</div>
		</div>
	);
}
