export interface User {
  id: string;
  email: string;
  role: 'student' | 'mentor' | 'admin';
  firstName: string;
  lastName: string;
}

export interface Student {
  id: string;
  user_id: string;
  roll_number: string;
  department: string;
  semester: number;
  cgpa?: number;
  bio?: string;
  project_interests?: string;
  first_name: string;
  last_name: string;
  email: string;
  skills?: Skill[];
}

export interface Mentor {
  id: string;
  user_id: string;
  employee_id: string;
  department: string;
  designation: string;
  domain?: string;
  bio?: string;
  max_capacity: number;
  is_available: boolean;
  first_name: string;
  last_name: string;
  email: string;
  active_allocations: number;
  remaining_capacity: number;
  skills?: Skill[];
}

export interface Skill {
  name: string;
  category: string;
  proficiency?: string;
}

export interface Team {
  id: string;
  cycle_id: string;
  name: string;
  description?: string;
  project_topic?: string;
  project_domain?: string;
  leader_id: string;
  status: 'forming' | 'active' | 'allocated' | 'completed';
  member_count: number;
  members?: TeamMember[];
}

export interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  roll_number: string;
  is_leader: boolean;
}

export interface MentorRequest {
  id: string;
  team_id: string;
  mentor_id: string;
  cycle_id: string;
  status: string;
  priority: number;
  priority_score: number;
  enqueue_time: string;
  processing_start?: string;
  completion_time?: string;
  failure_reason?: string;
  rejection_comments?: string;
  message?: string;
  team_name: string;
  project_domain?: string;
  mentor_first: string;
  mentor_last: string;
  mentor_domain?: string;
}

export interface Allocation {
  id: string;
  team_id: string;
  mentor_id: string;
  cycle_id: string;
  request_id: string;
  status: string;
  allocated_at: string;
  notes?: string;
  team_name: string;
  project_domain?: string;
  mentor_first: string;
  mentor_last: string;
  mentor_domain?: string;
}

export interface BankersState {
  processes: string[];
  resources: string[];
  available: number[];
  max: number[][];
  allocation: number[][];
}

export interface SafetyResult {
  isSafe: boolean;
  safeSequence: string[];
  steps: any[];
  need: number[][];
}
