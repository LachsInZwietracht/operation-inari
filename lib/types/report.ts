import { ID, Timestamped } from "./common"

export interface ReportTemplate extends Timestamped {
  id: ID
  name: string
  category: string
  content: string
}
