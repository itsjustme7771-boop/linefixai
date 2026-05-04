---
name: equipment-knowledge-base
description: "General industrial equipment failure patterns for food processing environments. Industry-standard knowledge — no company proprietary content."
metadata:
  author: tech82.zo.computer
---

# Equipment Knowledge Base — General Industrial Food Processing

## Conveyor Systems

### Belt Conveyors
**Common failures:**
- Belt tracking deviation (misaligned rollers, debris on pulley, worn belt)
- Belt slippage (tension loss, contaminated pulley surface, motor overload)
- Motor won't start (disconnect OFF, overload tripped, PLC output dead, VFD fault)
- Belt stops mid-cycle (E-stop triggered, safety circuit open, jam detected)
- Excessive belt wear (misalignment, contamination, wrong belt type for product)

**Diagnostic sequence:**
1. Check disconnect and overload reset
2. Verify PLC input for start command
3. Check VFD status/fault code
4. Inspect belt condition and tension
5. Examine pulley alignment

### Table-Top / Slat Conveyors
**Common failures:**
- Chain stretch or跳齿 (skipping)
- Rail misalignment causing product tipping
- Drive sprocket wear

**Diagnostic sequence:**
1. Inspect chain tension and condition
2. Check sprocket teeth for wear
3. Verify rail alignment
4. Check for product buildup in rails

---

## VFD-Controlled Motors

### Standard Fault Codes (Common Industrial VFDs)
| Code | Meaning | First Action |
|------|---------|--------------|
| F001 / OL1 | Motor overload | Check load, motor winding, thermal relay |
| F002 / OC1 | Overcurrent | Check motor leads for short, blocked load |
| F003 / OV | Overvoltage | Check incoming supply, deceleration rate |
| F004 / UV | Undervoltage | Check supply voltage, tighten connections |
| F005 / GF | Ground fault | Megger motor leads, check insulation |
| F006 / OC2 | Output overcurrent | Check motor windings, VFD output transistors |
| F007 | Communication loss | Check network, reseat communication card |
| F008 | External fault | Check safety circuit, E-stop, door interlocks |

**Diagnostic sequence:**
1. Record fault code from VFD display
2. Check DC bus voltage
3. Test motor windings with megohmmeter
4. Check VFD output with oscilloscope (if available)
5. Review VFD fault history (most VFDs store last 5-10 faults)

---

## Pneumatic Systems

### 5/2 and 3/2 Solenoid Valves
**Common failures:**
- Coil failure (open winding, resistance out of spec — typical 20-100Ω)
- Valve stuck (contamination, moisture, worn seals)
- Pilot valve failure (dirt in pilot circuit)

**Diagnostic sequence:**
1. Verify 24VDC supply at coil
2. Test coil resistance (compare to spec)
3. Check pilot air supply (for piloted valves)
4. Listen for exhaust when energized
5. Check muffler for contamination (indicates worn seals)

### FRL (Filter-Regulator-Lubricator)
**Common failures:**
- Low downstream pressure (clogged filter, failed regulator)
- Excessive oil carryover (incorrect lubrication setting, wrong oil type)
- Air leakage at fittings (wear, improper assembly)

---

## Hydraulic Systems

### Lift Tables and Dumpers
**Common failures:**
- Slow lift/lower speed (pump wear, internal leakage, low oil level)
- Unusual noise (pump cavitation, aerated oil, worn bearings)
- Drift down (valve leakage, cylinder seal failure)
- Won't lift (motor failure, pump damage, electrical fault, low pressure)

**Diagnostic sequence:**
1. Check oil level and condition (dark/black = degraded, milky = water contamination)
2. Verify pump motor running and drawing correct current
3. Check pressure at pump outlet (compare to spec)
4. Test cylinder for internal leakage (hold under load, watch for drift)
5. Check holding valve for leakage

---

## Sensors and Instrumentation

### Photo-Eye Sensors
**Common failures:**
- Inconsistent triggering (fouled lens, misalignment, contamination)
- No signal (dead sensor, wiring issue, power supply fault)
- Ghost triggers (reflected light, ambient light interference, dust accumulation)

**Diagnostic sequence:**
1. Check alignment LED on sensor (if equipped)
2. Clean lens with isopropyl
3. Realign reflector
4. Verify 24VDC supply
5. Test output signal at PLC input

### Level Float Switches
**Common failures:**
- Stuck float (product buildup, mechanical obstruction)
- Wonky readings (float not moving freely, switch contacts pitted)
- Corroded contacts (washdown environment, wrong IP rating)

### Pressure Transducers
**Common failures:**
- Signal drift (4-20mA reading off)
- No output (dead sensor, wiring break)
- Intermittent readings (loose connection, water intrusion)

**Diagnostic sequence:**
1. Verify 24VDC supply
2. Measure 4-20mA signal at controller
3. Check shielded cable shielding (ground at one end only)

---

## Electrical Safety Circuits

### E-Stop Circuits
**Common failure modes:**
- CR (control relay) contacts wet from washdown (moisture contamination)
- Door switch misaligned or actuator damaged
- Safety relay failed (watchdog timeout, contacts welded)
- Faulty E-stop button (contact corrosion)

**Post-sanitation start sequence:**
1. Verify disconnect is ON
2. Check E-stop buttons reset (pull out, twist)
3. Confirm all guards are closed and door switches made
4. Reset safety relay if equipped
5. Check PLC inputs for safety circuit status

---

## Standard LOTO Sequence

1. Notify affected employees
2. Identify all energy sources (electrical, hydraulic, pneumatic, mechanical)
3. Shut off equipment using normal stop procedures
4. Isolate energy sources — apply lockout/tagout devices
5. Release stored energy (bleed pressure, block elevated parts, discharge capacitors)
6. Verify zero energy — use voltage meter, pressure gauge, etc.
7. Perform work
8. Remove tools and materials
9. Remove locks — notify employees, restart

---

## Quick-Fix Patterns (60-Second Diagnoses)

### Conveyor Dead — No HMI Fault
1. Check end-of-line disconnect ON
2. Check overload reset button on motor starter
3. Look for E-stop pulled
4. Check for tripped circuit breaker
5. Verify PLC output light for start command

### Motor Humming But Not Running
1. Check VFD parameters — wrong frequency or direction setting
2. Check motor leads at VFD output
3. Is it a single-phase condition? Check all three phases
4. Remove load — see if motor turns alone

### Photo-Eye Not Triggering
1. Clean lens
2. Realign reflector
3. Check alignment LED
4. Verify PLC input light ON
5. Bypass test — jumper PLC input manually

### VFD Trips Repeatedly
1. Note fault code — look up meaning
2. Check cooling fans on VFD heatsink
3. Check ambient temperature — VFD derates above 40°C
4. Check motor load — is it jammed or binding?
5. Check acceleration/deceleration times — too fast strains motor

---

## Prevention Best Practices

- **Weekly**: Check belt tension and tracking, inspect sensors for contamination
- **Monthly**: Check VFD cooling fans, inspect electrical connections for corrosion, check oil level in hydraulics, clean pneumatics FRL
- **Quarterly**: Megger motor leads, check pneumatic system for leaks, inspect safety circuits
- **Annual**: Full VFD parameter backup and review, replace pneumatic mufflers, inspect conveyor belt for wear patterns