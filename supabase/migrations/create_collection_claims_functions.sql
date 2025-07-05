-- Function to prevent duplicate active claims
CREATE OR REPLACE FUNCTION prevent_duplicate_active_claims() RETURNS TRIGGER AS $$
BEGIN
    -- Si estamos actualizando una reclamación a 'completed' o 'cancelled', no necesitamos verificar
    IF (TG_OP = 'UPDATE' AND (NEW.status = 'completed' OR NEW.status = 'cancelled')) THEN
        RETURN NEW;
    END IF;
    
    -- Verificar si ya existe un claim activo para este punto
    IF EXISTS (
        SELECT 1 FROM collection_claims 
        WHERE collection_point_id = NEW.collection_point_id 
        AND status = 'claimed'
        AND id != NEW.id
    ) THEN
        RAISE EXCEPTION 'Ya existe una reclamación activa para este punto de recolección';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to set point as claimed when a claim is created
CREATE OR REPLACE FUNCTION set_point_claimed_on_claim() RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar el estado del punto de recolección a "claimed"
    UPDATE collection_points
    SET 
        status = 'claimed',
        claim_id = NEW.id,
        recycler_id = NEW.recycler_id,
        pickup_time = NEW.pickup_time
    WHERE id = NEW.collection_point_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to add eco credits when claim is completed
CREATE OR REPLACE FUNCTION sumar_eco_creditos_al_completar_claim() RETURNS TRIGGER AS $$
DECLARE
    resident_id uuid;
    recycler_id uuid;
    creditos_actuales integer;
BEGIN
    -- Solo actuar si el estado cambió a 'completed'
    IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
        -- Obtener el ID del residente asociado al punto de recolección
        SELECT user_id INTO resident_id
        FROM collection_points
        WHERE id = NEW.collection_point_id;
        
        -- Sumar 10 EcoCreditos al residente
        UPDATE profiles
        SET eco_creditos = COALESCE(eco_creditos, 0) + 10
        WHERE user_id = resident_id;
        
        -- También podría dar créditos al reciclador
        recycler_id := NEW.recycler_id;
        UPDATE profiles
        SET eco_creditos = COALESCE(eco_creditos, 0) + 5
        WHERE user_id = recycler_id;
        
        -- Crear notificación para el residente
        INSERT INTO notifications (
            user_id, 
            title, 
            content,
            type,
            related_id
        ) VALUES (
            resident_id,
            'Recolección Completada',
            'Tu punto de recolección ha sido completado exitosamente. Has ganado 10 EcoCreditos.',
            'collection_completed',
            NEW.collection_point_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update the updated_at field
CREATE OR REPLACE FUNCTION update_collection_claims_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
