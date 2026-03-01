// ============================================================================
// Phase 1: High-Priority Components
// ============================================================================
// Chart, DatePicker, Calendar, FileUpload
// ============================================================================

"use client";

import React, { useState, useCallback, useMemo } from "react";
import { format, parseISO, isValid, isBefore, isAfter, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay, getDate } from "date-fns";

// Recharts imports - requires: npm install recharts
// Stub implementation for now - replace with actual recharts when installed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LineChart = ({ children }: { children?: React.ReactNode; data?: unknown[]; onClick?: (data: unknown) => void }) => (
  <div className="flex items-center justify-center h-full text-muted-foreground">
    📊 Install recharts to use LineChart component
    {children}
  </div>
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Line = (props: Record<string, unknown>) => null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BarChart = ({ children }: { children?: React.ReactNode; data?: unknown[]; onClick?: (data: unknown) => void }) => (
  <div className="flex items-center justify-center h-full text-muted-foreground">
    📊 Install recharts to use BarChart component
    {children}
  </div>
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Bar = (props: Record<string, unknown>) => null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PieChart = ({ children, onClick }: { children?: React.ReactNode; onClick?: (data: unknown) => void }) => (
  <div className="flex items-center justify-center h-full text-muted-foreground">
    📊 Install recharts to use PieChart component
    {children}
  </div>
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Pie = (props: Record<string, unknown>) => null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AreaChart = ({ children }: { children?: React.ReactNode; data?: unknown[]; onClick?: (data: unknown) => void }) => (
  <div className="flex items-center justify-center h-full text-muted-foreground">
    📊 Install recharts to use AreaChart component
    {children}
  </div>
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Area = (props: Record<string, unknown>) => null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ScatterChart = ({ children, onClick }: { children?: React.ReactNode; onClick?: (data: unknown) => void }) => (
  <div className="flex items-center justify-center h-full text-muted-foreground">
    📊 Install recharts to use ScatterChart component
    {children}
  </div>
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Scatter = (props: Record<string, unknown>) => null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const XAxis = (props: Record<string, unknown>) => null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const YAxis = (props: Record<string, unknown>) => null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CartesianGrid = (props: Record<string, unknown>) => null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RechartsTooltip = (props: Record<string, unknown>) => null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RechartsLegend = (props: Record<string, unknown>) => null;
const RechartsResponsiveContainer = ({ children, width, height }: { children?: React.ReactNode; width?: string | number; height?: string | number }) => (
  <div className="w-full h-full" style={{ width, height }}>{children}</div>
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Cell = (props: Record<string, unknown>) => null;
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Calendar as CalendarIcon,
  Upload,
  X,
  FileIcon,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";

// Import types
import type {
  ChartProps,
  DatePickerProps,
  CalendarProps,
  FileUploadProps,
  RenderContext,
} from "../a2ui.types.extended";
import { resolvePath, resolveValue, isVisible } from "../A2UIRenderer";

// ============================================================================
// Chart Component
// ============================================================================

const CHART_COLORS = [
  "#007aff", // iOS Blue
  "#34c759", // iOS Green
  "#ff9500", // iOS Orange
  "#ff3b30", // iOS Red
  "#5856d6", // iOS Purple
  "#5ac8fa", // iOS Light Blue
  "#ffcc00", // iOS Yellow
  "#af52de", // iOS Pink
];

export function ChartRenderer({
  props,
  context,
}: {
  props: ChartProps;
  context: RenderContext;
}) {
  if (!isVisible(props, context.dataModel)) return null;

  const data = useMemo(() => {
    const rawData = props.dataPath
      ? (resolvePath(context.dataModel, props.dataPath) as Array<Record<string, unknown>>)
      : props.data;
    return Array.isArray(rawData) ? rawData : [];
  }, [props.data, props.dataPath, context.dataModel]);

  const height = props.height || 300;
  const animated = props.animated !== false;

  const handleClick = useCallback(
    (dataPoint: unknown) => {
      if (props.onPointClick) {
        context.onAction(props.onPointClick, { dataPoint });
      }
    },
    [props.onPointClick, context]
  );

  const renderChart = () => {
    switch (props.type) {
      case "line":
        return (
          <LineChart data={data} onClick={handleClick}>
            {props.grid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />}
            <XAxis
              dataKey={props.xAxis?.key}
              type={props.xAxis?.type || "category"}
              stroke="var(--text-tertiary)"
            />
            <YAxis
              domain={[props.yAxis?.min || "auto", props.yAxis?.max || "auto"]}
              stroke="var(--text-tertiary)"
            />
            {props.tooltip && <RechartsTooltip />}
            {props.legend && <RechartsLegend />}
            {props.series.map((s, idx) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color || CHART_COLORS[idx % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ fill: s.color || CHART_COLORS[idx % CHART_COLORS.length] }}
                animationDuration={animated ? 1500 : 0}
              />
            ))}
          </LineChart>
        );

      case "bar":
        return (
          <BarChart data={data} onClick={handleClick}>
            {props.grid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />}
            <XAxis dataKey={props.xAxis?.key} stroke="var(--text-tertiary)" />
            <YAxis
              domain={[props.yAxis?.min || "auto", props.yAxis?.max || "auto"]}
              stroke="var(--text-tertiary)"
            />
            {props.tooltip && <RechartsTooltip />}
            {props.legend && <RechartsLegend />}
            {props.series.map((s, idx) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={s.color || CHART_COLORS[idx % CHART_COLORS.length]}
                animationDuration={animated ? 1500 : 0}
              />
            ))}
          </BarChart>
        );

      case "area":
        return (
          <AreaChart data={data} onClick={handleClick}>
            {props.grid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />}
            <XAxis dataKey={props.xAxis?.key} stroke="var(--text-tertiary)" />
            <YAxis
              domain={[props.yAxis?.min || "auto", props.yAxis?.max || "auto"]}
              stroke="var(--text-tertiary)"
            />
            {props.tooltip && <RechartsTooltip />}
            {props.legend && <RechartsLegend />}
            {props.series.map((s, idx) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color || CHART_COLORS[idx % CHART_COLORS.length]}
                fill={s.color || CHART_COLORS[idx % CHART_COLORS.length]}
                fillOpacity={0.3}
                animationDuration={animated ? 1500 : 0}
              />
            ))}
          </AreaChart>
        );

      case "pie":
        const pieData = data.map((d) => ({
          name: String(d[props.xAxis?.key || "name"]),
          value: Number(d[props.series[0]?.key || "value"]),
        }));
        return (
          <PieChart onClick={handleClick}>
            {props.tooltip && <RechartsTooltip />}
            {props.legend && <RechartsLegend />}
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              dataKey="value"
              nameKey="name"
              label
              animationDuration={animated ? 1500 : 0}
            >
              {pieData.map((_, idx) => (
                <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        );

      case "scatter":
        return (
          <ScatterChart onClick={handleClick}>
            {props.grid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />}
            <XAxis
              type="number"
              dataKey={props.xAxis?.key}
              name={props.xAxis?.label}
              stroke="var(--text-tertiary)"
            />
            <YAxis
              type="number"
              dataKey={props.series[0]?.key}
              name={props.series[0]?.name}
              stroke="var(--text-tertiary)"
            />
            {props.tooltip && <RechartsTooltip cursor={{ strokeDasharray: "3 3" }} />}
            {props.legend && <RechartsLegend />}
            <Scatter
              name={props.series[0]?.name}
              data={data}
              fill={props.series[0]?.color || CHART_COLORS[0]}
            />
          </ScatterChart>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Chart type &quot;{props.type}&quot; not supported
          </div>
        );
    }
  };

  return (
    <div className="w-full" style={{ height }}>
      <RechartsResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </RechartsResponsiveContainer>
    </div>
  );
}

// ============================================================================
// DatePicker Component
// ============================================================================

export function DatePickerRenderer({
  props,
  context,
}: {
  props: DatePickerProps;
  context: RenderContext;
}) {
  if (!isVisible(props, context.dataModel)) return null;

  const value = resolvePath(context.dataModel, props.valuePath) as string;
  const isDisabled = resolveValue(props.disabled, context.dataModel, false);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    value ? parseISO(value) : null
  );

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    context.updateDataModel(
      props.valuePath,
      props.showTime
        ? date.toISOString()
        : format(date, "yyyy-MM-dd")
    );
    setIsOpen(false);
  };

  const minDate = props.minDate ? parseISO(props.minDate) : undefined;
  const maxDate = props.maxDate ? parseISO(props.maxDate) : undefined;

  return (
    <div className="space-y-1.5">
      {props.label && (
        <Label className="text-sm font-medium">{props.label}</Label>
      )}
      <div className="relative">
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal"
          onClick={() => !isDisabled && setIsOpen(!isOpen)}
          disabled={isDisabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? (
            format(
              selectedDate,
              props.showTime ? "PPp" : "PP"
            )
          ) : (
            <span className="text-muted-foreground">
              {props.placeholder || "Pick a date"}
            </span>
          )}
        </Button>

        {isOpen && (
          <div className="absolute z-50 mt-2 bg-popover border rounded-md shadow-lg p-3">
            <SimpleCalendar
              selected={selectedDate}
              onSelect={handleDateSelect}
              minDate={minDate}
              maxDate={maxDate}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Simple calendar component
function SimpleCalendar({
  selected,
  onSelect,
  minDate,
  maxDate,
}: {
  selected: Date | null;
  onSelect: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}) {
  const [currentMonth, setCurrentMonth] = useState(selected || new Date());

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const isDisabled = (date: Date) => {
    if (minDate && isBefore(date, minDate)) return true;
    if (maxDate && isAfter(date, maxDate)) return true;
    return false;
  };

  return (
    <div className="w-[280px]">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium">{format(currentMonth, "MMMM yyyy")}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const disabled = isDisabled(day);
          const isSelected = selected && isSameDay(day, selected);

          return (
            <button
              key={day.toISOString()}
              onClick={() => !disabled && onSelect(day)}
              disabled={disabled}
              className={cn(
                "h-8 w-8 rounded-md text-sm transition-colors",
                isSelected && "bg-primary text-primary-foreground",
                !isSelected && !disabled && "hover:bg-muted",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {getDate(day)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Calendar Component
// ============================================================================

export function CalendarRenderer({
  props,
  context,
}: {
  props: CalendarProps;
  context: RenderContext;
}) {
  if (!isVisible(props, context.dataModel)) return null;

  const value = resolvePath(context.dataModel, props.valuePath) as string;
  const events = props.events
    ? ((typeof props.events === "string"
        ? resolvePath(context.dataModel, props.events)
        : props.events) as CalendarProps["events"])
    : [];

  const [currentMonth, setCurrentMonth] = useState(
    value ? parseISO(value) : new Date()
  );

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getEventsForDay = (day: Date) => {
    if (!events || typeof events === 'string') return [];
    return events.filter((e: { date: string }) => isSameDay(parseISO(e.date), day));
  };

  const handleDateClick = (day: Date) => {
    if (props.onDateClick) {
      context.updateDataModel(props.valuePath, format(day, "yyyy-MM-dd"));
      context.onAction(props.onDateClick, { date: format(day, "yyyy-MM-dd") });
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium text-lg">
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="bg-muted p-2 text-center text-sm font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}

        {days.map((day) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);

          return (
            <div
              key={day.toISOString()}
              onClick={() => handleDateClick(day)}
              className={cn(
                "bg-card p-2 min-h-[80px] cursor-pointer hover:bg-muted/50 transition-colors",
                !isCurrentMonth && "opacity-50"
              )}
            >
              <div className="text-sm font-medium">{getDate(day)}</div>
              <div className="mt-1 space-y-1">
                {dayEvents.map((event: { date: string; title: string; color?: string; action?: string }, idx: number) => (
                  <div
                    key={idx}
                    className="text-xs px-1.5 py-0.5 rounded truncate"
                    style={{ backgroundColor: event.color || "var(--primary)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (props.onEventClick && event.action) {
                        context.onAction(event.action, { event });
                      }
                    }}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// FileUpload Component
// ============================================================================

export function FileUploadRenderer({
  props,
  context,
}: {
  props: FileUploadProps;
  context: RenderContext;
}) {
  if (!isVisible(props, context.dataModel)) return null;

  const value = (resolvePath(context.dataModel, props.valuePath) as Array<{
    name: string;
    size: number;
    type: string;
    url?: string;
  }>) || [];

  const isDisabled = resolveValue(props.disabled, context.dataModel, false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newFiles = Array.from(files).map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      file,
    }));

    // Update data model
    context.updateDataModel(props.valuePath, [...value, ...newFiles]);

    // Trigger upload action if specified
    if (props.uploadAction) {
      newFiles.forEach((file) => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          setUploadProgress((prev) => ({
            ...prev,
            [file.name]: progress,
          }));

          if (props.onUploadProgress) {
            context.onAction(props.onUploadProgress, {
              file: file.name,
              progress,
            });
          }

          if (progress >= 100) {
            clearInterval(interval);
            if (props.onUploadComplete) {
              context.onAction(props.onUploadComplete, { file: file.name });
            }
          }
        }, 200);
      });

      context.onAction(props.uploadAction, { files: newFiles });
    }

    if (props.onFileSelect) {
      context.onAction(props.onFileSelect, { files: newFiles });
    }
  };

  const removeFile = (fileName: string) => {
    context.updateDataModel(
      props.valuePath,
      value.filter((f) => f.name !== fileName)
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-1.5">
      {props.label && (
        <Label className="text-sm font-medium">{props.label}</Label>
      )}

      {props.dragDrop !== false ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFileSelect(e.dataTransfer.files);
          }}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground",
            isDisabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <Input
            type="file"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
            accept={props.accept}
            multiple={props.multiple !== false}
            disabled={isDisabled}
          />
          <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {isDragging
              ? "Drop files here..."
              : "Drag & drop files here, or click to select"}
          </p>
          {props.accept && (
            <p className="text-xs text-muted-foreground mt-1">
              Accepted: {props.accept}
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            type="file"
            onChange={(e) => handleFileSelect(e.target.files)}
            accept={props.accept}
            multiple={props.multiple !== false}
            disabled={isDisabled}
            className="cursor-pointer"
          />
        </div>
      )}

      {/* File list */}
      {value.length > 0 && (
        <div className="mt-3 space-y-2">
          {value.map((file, idx) => (
            <Card key={idx} className="p-3">
              <div className="flex items-center gap-3">
                {props.preview && file.type?.startsWith("image/") ? (
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>

                  {uploadProgress[file.name] !== undefined && (
                    <Progress
                      value={uploadProgress[file.name]}
                      className="h-1 mt-1"
                    />
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeFile(file.name)}
                  disabled={isDisabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
