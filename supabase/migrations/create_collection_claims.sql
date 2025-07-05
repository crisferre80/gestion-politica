-- Create collection_claims table
create table public.collection_claims (
  id uuid not null default gen_random_uuid (),
  collection_point_id uuid null,
  recycler_id uuid null,
  user_id uuid null,
  status text null default 'claimed'::text,
  pickup_time timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  cancellation_reason text null,
  cancelled_at text null,
  completed_at timestamp with time zone null,
  constraint collection_claims_pkey primary key (id),
  constraint unique_active_claim_per_point unique (collection_point_id) deferrable,
  constraint collection_claims_collection_point_id_fkey foreign KEY (collection_point_id) references collection_points (id) on delete CASCADE,
  constraint collection_claims_recycler_id_fkey foreign KEY (recycler_id) references profiles (user_id) on delete CASCADE,
  constraint collection_claims_user_id_fkey foreign KEY (user_id) references profiles (user_id) on delete CASCADE,
  constraint trg_prevent_duplicate_active_claims TRIGGER deferrable
) TABLESPACE pg_default;

-- Create trigger to prevent duplicate active claims
create constraint TRIGGER trg_prevent_duplicate_active_claims
after INSERT
or
update on collection_claims deferrable initially IMMEDIATE for EACH row
execute FUNCTION prevent_duplicate_active_claims ();

-- Create trigger to set point as claimed
create trigger trg_set_point_claimed_on_claim
after INSERT on collection_claims for EACH row
execute FUNCTION set_point_claimed_on_claim ();

-- Create trigger to add eco credits when claim is completed
create trigger trg_sumar_eco_creditos_al_completar_claim
after
update on collection_claims for EACH row
execute FUNCTION sumar_eco_creditos_al_completar_claim ();

-- Create trigger to update the updated_at field
create trigger trg_update_collection_claims_updated_at BEFORE
update on collection_claims for EACH row
execute FUNCTION update_collection_claims_updated_at ();
