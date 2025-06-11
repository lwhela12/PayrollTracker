CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"position" varchar(100),
	"mileage_rate" numeric(10, 4) DEFAULT '0.655',
	"is_active" boolean DEFAULT true,
	"employer_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"phone" varchar(20),
	"email" varchar(255),
	"tax_id" varchar(50),
	"owner_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pay_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_active" boolean DEFAULT false,
	"employer_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reimbursements" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"pay_period_id" integer NOT NULL,
	"description" varchar(255) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"category" varchar(100),
	"receipt_url" varchar(500),
	"is_approved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"employer_id" integer NOT NULL,
	"pay_period_id" integer,
	"report_type" varchar(100) NOT NULL,
	"format" varchar(20) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500),
	"generated_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timecards" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"pay_period_id" integer NOT NULL,
	"work_date" date NOT NULL,
	"time_in" time,
	"time_out" time,
	"lunch_minutes" integer DEFAULT 0,
	"regular_hours" numeric(5, 2) DEFAULT '0',
	"overtime_hours" numeric(5, 2) DEFAULT '0',
	"pto_hours" numeric(5, 2) DEFAULT '0',
	"holiday_hours" numeric(5, 2) DEFAULT '0',
	"start_odometer" integer,
	"end_odometer" integer,
	"total_miles" integer DEFAULT 0,
	"notes" text,
	"is_approved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employers" ADD CONSTRAINT "employers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_pay_period_id_pay_periods_id_fk" FOREIGN KEY ("pay_period_id") REFERENCES "public"."pay_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_pay_period_id_pay_periods_id_fk" FOREIGN KEY ("pay_period_id") REFERENCES "public"."pay_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timecards" ADD CONSTRAINT "timecards_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timecards" ADD CONSTRAINT "timecards_pay_period_id_pay_periods_id_fk" FOREIGN KEY ("pay_period_id") REFERENCES "public"."pay_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");