export interface RangeDto {
  start_time: number;
  end_time: number;
  duration: number;
}

export type RangeFragment = RangeDto & {
  fragmentIndex: number;
  subFragmentIndex: number;
  isLastFragment: boolean;
  isLastRangeSubFragment: boolean;
};
