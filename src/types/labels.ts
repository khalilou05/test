export interface LabelStyle {
  fontSize?: number;
  fontFamily?: string;
}

export interface LabelData {
  value: string;
  style: LabelStyle;
}

export interface StatLabel {
  label: string;
  value: string;
  style: LabelStyle;
}

export interface LabelsState {
  title: LabelData;
  description: LabelData;
  stats: StatLabel[];
}
