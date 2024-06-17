import { getStates } from "@/services/states";
import { State } from "@/types/state";
import { User } from "@/types/user";
import { Avatar, Select, SelectItem, Image } from "@nextui-org/react";
import { useEffect, useState } from "react";

export default function StateDropdown({ user, handleSelectState }: { user: User, handleSelectState: any }) {
    const [states, setStates] = useState<State[]>([]);

    useEffect(() => {
        (async () => {
            let states = await getStates();
            setStates(states);
        })();
    }, []);
    const handleSelectionChange = (e: any) => {
        handleSelectState(e.target.value);
    };
    return (
        <>
            {states && states.length > 0 && <Select
                label="Select state"
                startContent={<Image alt={user.state} src={`/states/flag/${user.state}.svg`} width={20} />}
                defaultSelectedKeys={[user.state]}
                onChange={handleSelectionChange}
            >
                {
                    states.map((state: State) => (
                        <SelectItem
                            key={state.name}
                            startContent={< Avatar alt={state.name} className="w-5 h-5" src={`/states/flag/${state.name}.svg`} />
                            }
                        >
                            {state.name}
                        </SelectItem>
                    ))
                }

            </Select >
            }
        </>
    );
};