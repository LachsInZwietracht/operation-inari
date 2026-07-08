"use client"

import { Target } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

/**
 * Placeholder tool card for the meal planner.
 *
 * Idea: enter a nutrient plus the amount still missing today (e.g. "400 mg
 * Calcium") and get concrete foods — with the portion size needed — that close
 * exactly that gap. Not implemented yet; the tile opens a concept dialog so the
 * design can settle before we build it.
 */
export function PlanNutrientGapTool() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="focus-visible:ring-ring/50 group w-full rounded-xl text-left focus-visible:ring-2 focus-visible:outline-none"
        >
          <Card className="group-hover:border-primary/40 h-full border-dashed transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="text-primary h-4 w-4" />
                Nährstoff-Lückenfüller
                <Badge variant="secondary" className="ml-auto text-[10px] font-normal">
                  In Planung
                </Badge>
              </CardTitle>
              <CardDescription>
                Fehlmenge eines Nährstoffs eingeben und passende Lebensmittel finden, die genau
                diese Lücke füllen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-muted-foreground group-hover:text-foreground text-xs font-medium transition-colors">
                Konzept ansehen →
              </span>
            </CardContent>
          </Card>
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="text-primary h-5 w-5" />
            Nährstoff-Lückenfüller
          </DialogTitle>
          <DialogDescription>
            Platzhalter – Funktion noch nicht gebaut. Dieser Dialog hält die Idee und einen
            Konzeptentwurf fest.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <section className="space-y-1.5">
            <h3 className="text-foreground font-semibold">Was das Tool macht</h3>
            <p className="text-muted-foreground">
              Man wählt einen Nährstoff (z.&nbsp;B. Calcium, Eisen, Vitamin&nbsp;D) und gibt die
              heute noch fehlende Menge samt Einheit ein – etwa „noch 400&nbsp;mg Calcium“. Das
              Tool durchsucht die Lebensmitteldatenbank und schlägt konkrete Lebensmittel mit der
              passenden Portionsgröße vor, um genau diese Lücke zu schließen.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-foreground font-semibold">So könnte der Ablauf aussehen</h3>
            <ol className="text-muted-foreground list-decimal space-y-1.5 pl-5">
              <li>
                <span className="text-foreground font-medium">Nährstoff wählen.</span> Aus dem
                Nährstoffkatalog; Einheit (mg, µg, g) wird automatisch übernommen.
              </li>
              <li>
                <span className="text-foreground font-medium">Fehlmenge eingeben.</span> Manuell
                oder vorbefüllt aus der tatsächlichen Restlücke des aktiven Tages (Zielprofil minus
                bereits geplante Menge).
              </li>
              <li>
                <span className="text-foreground font-medium">Treffer ranken.</span> Lebensmittel
                nach Nährstoffdichte sortiert, dazu je Treffer die nötige Portion („120&nbsp;g
                decken die Lücke“) und die Nebenwirkung auf andere Werte (z.&nbsp;B. zusätzliche
                kcal).
              </li>
              <li>
                <span className="text-foreground font-medium">Direkt übernehmen.</span> Vorgeschlagene
                Portion per Klick in eine Mahlzeit des aktiven Tages legen – die Lücke aktualisiert
                sich live.
              </li>
            </ol>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-foreground font-semibold">Abgrenzung zu „Vorschläge zum Auffüllen“</h3>
            <p className="text-muted-foreground">
              Das bestehende Optimizer-Tool schließt offene Ziele automatisch und ganzheitlich über
              den Plan. Der Lückenfüller ist bewusst gezielt und manuell: ein einzelner Nährstoff,
              eine vom Berater eingegebene Menge – auch unabhängig vom aktuellen Plan nutzbar, etwa
              zur schnellen Recherche „Was ist reich an Zink?“.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-foreground font-semibold">Mehrere Kriterien gleichzeitig</h3>
            <p className="text-muted-foreground">
              Neben dem Ziel-Nährstoff sollen sich weitere Nährstoffe als Nebenbedingung angeben
              lassen – z.&nbsp;B. „fülle die Calcium-Lücke, aber ohne mehr als 20&nbsp;g
              Kohlenhydrate hinzuzufügen“. Gesucht werden dann nur Lebensmittel, die alle Kriterien
              gleichzeitig erfüllen.
            </p>
            <ul className="text-muted-foreground list-disc space-y-1.5 pl-5">
              <li>
                <span className="text-foreground font-medium">Ein Zielnährstoff, mehrere Grenzen:</span>{" "}
                oben die zu füllende Lücke, darunter beliebig viele Bedingungen der Form „Nährstoff
                ≤ / ≥ Menge“ (z.&nbsp;B. KH&nbsp;≤&nbsp;20&nbsp;g, kcal&nbsp;≤&nbsp;150).
              </li>
              <li>
                <span className="text-foreground font-medium">Bewertung an der echten Portion:</span>{" "}
                die Portion ergibt sich aus der Ziellücke – die Nebenbedingungen werden dann für
                genau diese Portion geprüft („120&nbsp;g decken Calcium und bringen dabei
                14&nbsp;g&nbsp;KH → ok“). Ein Lebensmittel kann je nach nötiger Menge bestehen oder
                durchfallen, deshalb pro 100&nbsp;g zu prüfen wäre irreführend.
              </li>
              <li>
                <span className="text-foreground font-medium">Harte vs. weiche Kriterien:</span>{" "}
                harte Grenzen schließen aus; weiche Präferenzen werten nur ab, sodass knappe
                Grenzfälle weiter unten trotzdem sichtbar bleiben.
              </li>
            </ul>
            <p className="text-muted-foreground">
              <span className="text-foreground font-medium">Umsetzung:</span> Kandidaten grob
              serverseitig über <code className="text-xs">FoodBrowserQuery</code> vorfiltern
              (heute <code className="text-xs">nutrientMin/Max</code> für einen Nährstoff – für
              mehrere entweder die Query erweitern oder auf dem zurückgegebenen Kandidatenset
              client-seitig nachfiltern). Ranking: nach Dichte des Zielnährstoffs sortieren, dann
              die Nebenbedingungen an der berechneten Portion anwenden (harte raus, weiche als
              Score-Abzug).
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-foreground font-semibold">Offene Fragen</h3>
            <ul className="text-muted-foreground list-disc space-y-1.5 pl-5">
              <li>
                <span className="text-foreground font-medium">Dichte vs. realistische Portion:</span>{" "}
                reine Sortierung nach Gehalt pro 100&nbsp;g bringt getrocknete Gewürze o.&nbsp;Ä.
                nach oben, die niemand in Menge isst. Braucht wohl eine realistische Portions-Obergrenze
                (Anknüpfung an <code className="text-xs">etl:portions</code>).
              </li>
              <li>
                <span className="text-foreground font-medium">Quelle der Lücke:</span> manuelle
                Eingabe vs. automatisch aus Plan + Zielprofil. Automatisch wäre stärker und knüpft an
                die Micronährstoff-Compliance der Tagesziele-Leiste an.
              </li>
              <li>
                <span className="text-foreground font-medium">Randbedingungen:</span> Diätform/Allergene
                der aktiven Kostform respektieren, Kategorie-/Quellenfilter, ggf. kcal-Budget.
              </li>
              <li>
                <span className="text-foreground font-medium">Mehrere Ziel-Lücken:</span> ein
                Zielnährstoff plus Nebenbedingungen (siehe oben) deckt den Hauptfall ab; offen
                bleibt, ob v1 auch mehrere Lücken gleichzeitig ausbalancieren soll oder erst später.
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-foreground font-semibold">Technische Anknüpfungspunkte</h3>
            <p className="text-muted-foreground">
              <code className="text-xs">FoodBrowserQuery</code> unterstützt bereits{" "}
              <code className="text-xs">nutrientId</code>,{" "}
              <code className="text-xs">nutrientMin/Max</code> und{" "}
              <code className="text-xs">nutrientSort</code> – Filtern und Sortieren nach einem
              Nährstoff serverseitig ist also schon möglich. Portionsdaten aus{" "}
              <code className="text-xs">etl:portions</code>, Ziel-/Compliance-Werte aus der
              Tagesziele-Leiste.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
