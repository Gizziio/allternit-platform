/** Bundle stub for optional OpenTelemetry exporters not always installed. */
const Dummy: any = function Dummy() {}
Dummy.prototype = Dummy
const handler: ProxyHandler<any> = {
  get: () => Dummy,
  construct: () => Dummy,
  apply: () => Dummy,
}
const dummy = new Proxy(Dummy, handler)
export default dummy
export const MeterProvider = dummy
export const PeriodicExportingMetricReader = dummy
export const ConsoleMetricExporter = dummy
export const BasicTracerProvider = dummy
export const BatchSpanProcessor = dummy
export const SimpleSpanProcessor = dummy
export const ConsoleSpanExporter = dummy
export const AlwaysOnSampler = dummy
export const PrometheusExporter = dummy
export const OTLPMetricExporter = dummy
export const OTLPTraceExporter = dummy
export const OTLPLogExporter = dummy
export const AggregationTemporality = dummy
export const InMemorySpanExporter = dummy
export const NodeTracerProvider = dummy
export const Resource = dummy
export const OTLPGrpcTraceExporter = dummy
export const OTLPHttpTraceExporter = dummy
export const OTLPProtoTraceExporter = dummy
export const OTLPGrpcMetricExporter = dummy
export const OTLPHttpMetricExporter = dummy
export const OTLPProtoMetricExporter = dummy
export const OTLPGrpcLogExporter = dummy
export const OTLPHttpLogExporter = dummy
export const OTLPProtoLogExporter = dummy
