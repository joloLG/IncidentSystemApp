"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, Shield, Users, ChevronRight, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface RoleSelectionProps {
  onRoleSelected: (roleData: {
    category: 'hospital' | 'er_team'
    hospitalId?: string
    erTeamId?: string
  }) => void
  onBack: () => void
}

interface ErTeam {
  id: number
  er_team: string
}

export function RoleSelection({ onRoleSelected, onBack }: RoleSelectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<'hospital' | 'er_team' | null>(null)
  const [selectedHospital, setSelectedHospital] = useState<string>('')
  const [selectedErTeamType, setSelectedErTeamType] = useState<string>('')
  const [erTeams, setErTeams] = useState<ErTeam[]>([])
  const [loadingErTeams, setLoadingErTeams] = useState(false)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)

  const hospitals = [
    { id: '1', name: 'Bulan Medicare Hospital / Pawa Hospital' },
    { id: '2', name: 'SMMG - Bulan' },
    { id: '3', name: 'Sorsogon Provincial Hospital' },
    { id: '4', name: 'SMMG-HSC (SorDoc)' },
    { id: '5', name: 'Irosin District Hospital' },
    { id: '6', name: 'Irosin General Hospital / IMAC' }
  ]

  // Fetch ER teams on component mount
  useEffect(() => {
    const fetchErTeams = async () => {
      setLoadingErTeams(true)
      try {
        const { data, error } = await supabase
          .from('er_teams')
          .select('id, name')
          .order('name', { ascending: true })

        if (error) throw error
        setErTeams(data?.map(item => ({ id: item.id, er_team: item.name })) || [])
      } catch (error) {
        console.error('Error fetching ER teams:', error)
        // Fallback to empty array
        setErTeams([])
      } finally {
        setLoadingErTeams(false)
      }
    }

    fetchErTeams()
  }, [])

  const handleContinue = () => {
    setShowConfirmationModal(true)
  }

  const handleConfirmSelection = () => {
    if (selectedCategory === 'hospital' && selectedHospital) {
      onRoleSelected({
        category: 'hospital',
        hospitalId: selectedHospital
      })
    } else if (selectedCategory === 'er_team' && selectedErTeamType) {
      onRoleSelected({
        category: 'er_team',
        erTeamId: selectedErTeamType
      })
    }
    setShowConfirmationModal(false)
  }

  const canContinue = selectedCategory === 'hospital'
    ? !!selectedHospital
    : selectedCategory === 'er_team'
    ? !!selectedErTeamType
    : false

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative"
         style={{
           backgroundImage: "url('/images/mdrrmo_login_register_bg.jpg')",
           backgroundSize: "cover",
           backgroundPosition: "center",
           backgroundRepeat: "no-repeat",
         }}>
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black/40"></div>

      <Card className="w-full max-w-2xl bg-white/95 backdrop-blur-sm shadow-2xl relative z-10">
        <CardHeader className="text-center bg-orange-500 text-white rounded-t-lg">
          <CardTitle className="text-2xl font-bold">Stakeholder Registration</CardTitle>
          <p className="text-orange-100">Choose your role and organization</p>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          {!selectedCategory ? (
            <>
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Select Your Category</h3>
                <p className="text-sm text-gray-600">Choose the type of stakeholder role you need to register for</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setSelectedCategory('hospital')}
                  className="p-6 border-2 border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-all group"
                >
                  <div className="flex flex-col items-center space-y-3">
                    <Building2 className="h-12 w-12 text-orange-500 group-hover:scale-110 transition-transform" />
                    <div className="text-center">
                      <h4 className="font-semibold text-gray-800">Hospital Staff</h4>
                      <p className="text-sm text-gray-600">Medical facility personnel</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedCategory('er_team')}
                  className="p-6 border-2 border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-all group"
                >
                  <div className="flex flex-col items-center space-y-3">
                    <Shield className="h-12 w-12 text-orange-500 group-hover:scale-110 transition-transform" />
                    <div className="text-center">
                      <h4 className="font-semibold text-gray-800">Emergency Response Team</h4>
                      <p className="text-sm text-gray-600">First responders & emergency personnel</p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex justify-center pt-4">
                <Button
                  type="button"
                  onClick={onBack}
                  variant="outline"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Go Back to Login
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className="text-orange-600 hover:text-orange-700"
                >
                  ← Back to Categories
                </Button>
              </div>

              {selectedCategory === 'hospital' && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <Building2 className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold text-gray-800">Hospital Selection</h3>
                    <p className="text-sm text-gray-600">Select your affiliated hospital</p>
                  </div>

                  <div>
                    <Label htmlFor="hospital" className="text-gray-700 font-medium">
                      Choose Hospital *
                    </Label>
                    <Select value={selectedHospital} onValueChange={setSelectedHospital}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select your hospital" />
                      </SelectTrigger>
                      <SelectContent>
                        {hospitals.map((hospital) => (
                          <SelectItem key={hospital.id} value={hospital.id}>
                            {hospital.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {selectedCategory === 'er_team' && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <Shield className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold text-gray-800">Emergency Response Team</h3>
                    <p className="text-sm text-gray-600">Select your emergency response team</p>
                  </div>

                  <div>
                    <Label htmlFor="erTeamType" className="text-gray-700 font-medium">
                      ER Team *
                    </Label>
                    {loadingErTeams ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="ml-2 text-sm text-gray-600">Loading ER teams...</span>
                      </div>
                    ) : erTeams.length === 0 ? (
                      <div className="text-center py-4 text-red-600">
                        <p>No ER teams available. Please contact administrator.</p>
                      </div>
                    ) : (
                      <Select value={selectedErTeamType} onValueChange={setSelectedErTeamType}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select your ER team" />
                        </SelectTrigger>
                        <SelectContent>
                          {erTeams.map((team) => (
                            <SelectItem key={team.id} value={team.id.toString()}>
                              {team.er_team}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedCategory(null)
                    setSelectedHospital('')
                    setSelectedErTeamType('')
                    onBack()
                  }}
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={onBack}
                  variant="secondary"
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                >
                  Go Back to Login
                </Button>
                <Button
                  type="button"
                  onClick={handleContinue}
                  disabled={!canContinue}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Continue to Registration
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showConfirmationModal} onOpenChange={setShowConfirmationModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Your Selection</DialogTitle>
            <DialogDescription>
              Please confirm your role and organization selection before proceeding to registration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-orange-50 p-4 rounded-lg">
              <h4 className="font-semibold text-orange-800 mb-2">Selected Role:</h4>
              <p className="text-gray-700">
                <strong>
                  {selectedCategory === 'hospital' ? 'Hospital Staff' : 'Emergency Response Team'}
                </strong>
              </p>
              <h4 className="font-semibold text-orange-800 mt-3 mb-2">Organization:</h4>
              <p className="text-gray-700">
                {selectedCategory === 'hospital'
                  ? hospitals.find(h => h.id === selectedHospital)?.name
                  : erTeams.find(t => t.id.toString() === selectedErTeamType)?.er_team
                }
              </p>
            </div>
            <p className="text-sm text-gray-600">
              By proceeding, you will be directed to the registration form where you can create your account.
              Your request will be sent to the MDRRMO Super Admin for approval.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirmationModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSelection}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Proceed to Registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
